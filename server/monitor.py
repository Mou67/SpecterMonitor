"""
Hardware + Process monitoring module.
Collects CPU, GPU, RAM, Disk, Network metrics and full process listings.
Extracts .exe icons as base64 on Windows.
"""
import time
import platform
import socket
import base64
import io
import logging
import re
import psutil

try:
    import GPUtil
    GPU_AVAILABLE = True
except (ImportError, Exception):
    GPU_AVAILABLE = False

try:
    import pynvml
    PYNVML_AVAILABLE = True
except (ImportError, Exception):
    PYNVML_AVAILABLE = False

_icon_cache: dict[str, str | None] = {}
_ICON_EXTRACT_AVAILABLE = False
try:
    if platform.system() == "Windows":
        import win32gui
        import win32ui
        import win32con
        from PIL import Image
        _ICON_EXTRACT_AVAILABLE = True
except ImportError:
    pass

try:
    import cpuinfo
    CPUINFO_AVAILABLE = True
except ImportError:
    CPUINFO_AVAILABLE = False

_WMI_AVAILABLE = False
_wmi_conn = None
try:
    if platform.system() == "Windows":
        import wmi
        _wmi_conn = wmi.WMI()
        _WMI_AVAILABLE = True
except ImportError:
    pass

from models import (
    SystemSnapshot, CpuMetrics, GpuMetrics,
    RamMetrics, DiskMetrics, NetworkMetrics, ProcessInfo,
    CpuDetailMetrics, CpuCoreDetail,
    RamDetailMetrics, RamSlotInfo,
    GpuDetailMetrics,
)

logger = logging.getLogger(__name__)

_prev_net = None
_prev_net_time = None


def extract_icon_base64(exe_path: str) -> str | None:
    """Extract the icon from an .exe file and return as base64 PNG string."""
    if not _ICON_EXTRACT_AVAILABLE or not exe_path:
        return None

    if exe_path in _icon_cache:
        return _icon_cache[exe_path]

    try:
        if len(_icon_cache) > 500:
            return None

        large, small = win32gui.ExtractIconEx(exe_path, 0)
        if not large:
            _icon_cache[exe_path] = None
            return None

        hicon = large[0]

        hdc = win32ui.CreateDCFromHandle(win32gui.GetDC(0))
        hbmp = win32ui.CreateBitmap()
        hbmp.CreateCompatibleBitmap(hdc, 32, 32)
        hdc_mem = hdc.CreateCompatibleDC()
        hdc_mem.SelectObject(hbmp)

        hdc_mem.FillSolidRect((0, 0, 32, 32), 0x00000000)
        win32gui.DrawIconEx(
            hdc_mem.GetHandleOutput(), 0, 0, hicon,
            32, 32, 0, 0, win32con.DI_NORMAL,
        )

        bmpinfo = hbmp.GetInfo()
        bmpstr = hbmp.GetBitmapBits(True)
        img = Image.frombuffer(
            "RGBA", (bmpinfo["bmWidth"], bmpinfo["bmHeight"]),
            bmpstr, "raw", "BGRA", 0, 1,
        )

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        win32gui.DestroyIcon(hicon)
        for s in small:
            win32gui.DestroyIcon(s)
        hdc_mem.DeleteDC()
        hdc.DeleteDC()

        _icon_cache[exe_path] = b64
        return b64

    except Exception:
        _icon_cache[exe_path] = None
        return None


def get_cpu_metrics() -> CpuMetrics:
    freq = psutil.cpu_freq()
    per_core = psutil.cpu_percent(interval=0, percpu=True)

    temperature = None
    try:
        _sensors_temperatures = getattr(psutil, "sensors_temperatures", None)
        temps = _sensors_temperatures() if _sensors_temperatures else None
        if temps:
            for name in ("coretemp", "cpu_thermal", "k10temp", "zenpower"):
                if name in temps and temps[name]:
                    temperature = temps[name][0].current
                    break
            if temperature is None:
                first_key = next(iter(temps))
                if temps[first_key]:
                    temperature = temps[first_key][0].current
    except (AttributeError, Exception):
        logger.debug("Failed to read CPU temperature", exc_info=True)

    return CpuMetrics(
        usage_percent=psutil.cpu_percent(interval=0),
        frequency_mhz=freq.current if freq else 0,
        cores_physical=psutil.cpu_count(logical=False) or 1,
        cores_logical=psutil.cpu_count(logical=True) or 1,
        per_core_usage=per_core,
        temperature=temperature,
    )


_cpu_static_info: dict | None = None


def _get_cpu_static_info() -> dict:
    """Gather CPU identification, cache sizes, and features (cached after first call)."""
    global _cpu_static_info
    if _cpu_static_info is not None:
        return _cpu_static_info

    info: dict = {
        "model_name": platform.processor() or "Unknown",
        "architecture": platform.machine() or "Unknown",
        "vendor": "Unknown",
        "stepping": None,
        "revision": None,
        "codename": None,
        "tdp_watts": None,
        "l1_cache": None,
        "l2_cache": None,
        "l3_cache": None,
        "base_frequency_mhz": 0.0,
        "max_frequency_mhz": None,
        "features": [],
    }

    if CPUINFO_AVAILABLE:
        try:
            ci = cpuinfo.get_cpu_info()
            info["model_name"] = ci.get("brand_raw", info["model_name"])
            info["architecture"] = ci.get("arch_string_raw", info["architecture"])
            info["vendor"] = ci.get("vendor_id_raw", "Unknown")
            info["stepping"] = str(ci["stepping"]) if "stepping" in ci else None
            info["revision"] = ci.get("cpuid_revision") or ci.get("hardware_raw")
            info["codename"] = ci.get("cpuinfo_microarch") or ci.get("arch_string_raw")

            l1 = ci.get("l1_data_cache_size")
            l2 = ci.get("l2_cache_size")
            l3 = ci.get("l3_cache_size")
            if l1:
                info["l1_cache"] = str(l1)
            if l2:
                info["l2_cache"] = str(l2)
            if l3:
                info["l3_cache"] = str(l3)

            hz_adv = ci.get("hz_advertised_friendly")
            if hz_adv:
                info["base_frequency_mhz"] = _parse_freq_to_mhz(hz_adv)

            flags = ci.get("flags", [])
            if flags:
                interesting = {
                    "sse", "sse2", "sse3", "ssse3", "sse4_1", "sse4_2",
                    "avx", "avx2", "avx512f", "avx512bw", "avx512vl",
                    "aes", "fma", "fma3", "fma4",
                    "vmx", "svm",
                    "bmi1", "bmi2", "popcnt", "f16c", "movbe",
                    "rdrand", "rdseed", "sha_ni",
                    "mmx", "3dnow", "3dnowext",
                }
                matched = [f for f in flags if f in interesting]
                matched += [f for f in flags if f.startswith("avx512") and f not in matched]
                info["features"] = sorted(set(matched))
        except Exception:
            logger.debug("Failed to read cpuinfo", exc_info=True)

    if _WMI_AVAILABLE and _wmi_conn:
        try:
            procs = _wmi_conn.Win32_Processor()
            if procs:
                p = procs[0]
                if info["model_name"] in ("Unknown", "") or not CPUINFO_AVAILABLE:
                    info["model_name"] = p.Name.strip() if p.Name else info["model_name"]
                if info["vendor"] == "Unknown":
                    info["vendor"] = p.Manufacturer or "Unknown"
                if p.L2CacheSize and not info["l2_cache"]:
                    info["l2_cache"] = f"{p.L2CacheSize} KiB"
                if p.L3CacheSize and not info["l3_cache"]:
                    info["l3_cache"] = f"{p.L3CacheSize} KiB"
                if p.MaxClockSpeed:
                    info["max_frequency_mhz"] = float(p.MaxClockSpeed)
                if not info["base_frequency_mhz"] and p.CurrentClockSpeed:
                    info["base_frequency_mhz"] = float(p.CurrentClockSpeed)
                if p.Stepping:
                    info["stepping"] = info["stepping"] or str(p.Stepping)
                if p.Revision:
                    info["revision"] = info["revision"] or str(p.Revision)

                if hasattr(p, "VirtualizationFirmwareEnabled"):
                    if p.VirtualizationFirmwareEnabled and "vmx" not in info["features"] and "svm" not in info["features"]:
                        info["features"].append("vt-x")

                if p.Name:
                    tdp_match = re.search(r'(\d+)\s*[Ww]', p.Name)
                    if tdp_match and not info["tdp_watts"]:
                        info["tdp_watts"] = int(tdp_match.group(1))
        except Exception:
            logger.debug("Failed to read WMI CPU data", exc_info=True)

    freq = psutil.cpu_freq()
    if freq:
        if not info["base_frequency_mhz"]:
            info["base_frequency_mhz"] = freq.current
        if not info["max_frequency_mhz"] and freq.max:
            info["max_frequency_mhz"] = freq.max

    _cpu_static_info = info
    return _cpu_static_info


def _parse_freq_to_mhz(freq_str: str) -> float:
    """Convert a human-readable frequency string like '3.4000 GHz' to MHz."""
    try:
        parts = freq_str.lower().replace(",", ".").split()
        val = float(parts[0])
        if len(parts) > 1 and "ghz" in parts[1]:
            val *= 1000
        return val
    except Exception:
        return 0.0


def _get_per_core_frequencies() -> list[float]:
    """Try to get per-core current frequencies in MHz."""
    try:
        freqs = psutil.cpu_freq(percpu=True)
        if freqs and len(freqs) > 1:
            return [f.current for f in freqs]
    except Exception:
        logger.debug("Failed to read per-core frequencies", exc_info=True)

    if _WMI_AVAILABLE and _wmi_conn:
        try:
            procs = _wmi_conn.Win32_Processor()
            if procs:
                mhz = float(procs[0].CurrentClockSpeed or 0)
                count = psutil.cpu_count(logical=True) or 1
                return [mhz] * count
        except Exception:
            logger.debug("WMI frequency fallback failed", exc_info=True)

    freq = psutil.cpu_freq()
    count = psutil.cpu_count(logical=True) or 1
    return [freq.current if freq else 0.0] * count


def _get_cpu_voltage() -> float | None:
    """Try to read CPU voltage. Available on some Linux sensors or via WMI."""
    if _WMI_AVAILABLE and _wmi_conn:
        try:
            procs = _wmi_conn.Win32_Processor()
            if procs and procs[0].CurrentVoltage:
                return round(procs[0].CurrentVoltage / 10.0, 3)
        except Exception:
            logger.debug("Failed to read CPU voltage via WMI", exc_info=True)

    try:
        _sensors = getattr(psutil, "sensors_temperatures", None)
        if _sensors:
            temps = _sensors()
            for key in temps:
                if "voltage" in key.lower() or "in0" in key.lower():
                    if temps[key]:
                        return temps[key][0].current
    except Exception:
        logger.debug("Failed to read CPU voltage via sensors", exc_info=True)

    return None


def get_cpu_detail_metrics() -> CpuDetailMetrics:
    """Collect deep-dive CPU metrics including identification, cache, per-core freq, and features."""
    static = _get_cpu_static_info()
    per_core_usage = psutil.cpu_percent(interval=0, percpu=True)
    per_core_freqs = _get_per_core_frequencies()

    core_count = len(per_core_usage)
    if len(per_core_freqs) < core_count:
        per_core_freqs.extend([per_core_freqs[-1] if per_core_freqs else 0.0] * (core_count - len(per_core_freqs)))

    per_core_detail = [
        CpuCoreDetail(
            core_id=i,
            usage_percent=per_core_usage[i],
            frequency_mhz=per_core_freqs[i],
        )
        for i in range(core_count)
    ]

    temperature = None
    try:
        _sensors_temperatures = getattr(psutil, "sensors_temperatures", None)
        temps = _sensors_temperatures() if _sensors_temperatures else None
        if temps:
            for name in ("coretemp", "cpu_thermal", "k10temp", "zenpower"):
                if name in temps and temps[name]:
                    temperature = temps[name][0].current
                    break
            if temperature is None:
                first_key = next(iter(temps))
                if temps[first_key]:
                    temperature = temps[first_key][0].current
    except Exception:
        logger.debug("Failed to read CPU temperature for detail", exc_info=True)

    return CpuDetailMetrics(
        model_name=static["model_name"],
        architecture=static["architecture"],
        vendor=static["vendor"],
        stepping=static["stepping"],
        revision=static["revision"],
        codename=static["codename"],
        cores_physical=psutil.cpu_count(logical=False) or 1,
        cores_logical=psutil.cpu_count(logical=True) or 1,
        l1_cache=static["l1_cache"],
        l2_cache=static["l2_cache"],
        l3_cache=static["l3_cache"],
        base_frequency_mhz=static["base_frequency_mhz"],
        max_frequency_mhz=static["max_frequency_mhz"],
        tdp_watts=static["tdp_watts"],
        per_core_detail=per_core_detail,
        overall_usage=psutil.cpu_percent(interval=0),
        temperature=temperature,
        voltage=_get_cpu_voltage(),
        features=static["features"],
    )


def get_gpu_metrics() -> list[GpuMetrics]:
    gpus = []
    if not GPU_AVAILABLE:
        return gpus
    try:
        gpu_list = GPUtil.getGPUs()
        for g in gpu_list:
            gpus.append(GpuMetrics(
                name=g.name,
                load_percent=round(g.load * 100, 1),
                memory_used_mb=round(g.memoryUsed, 1),
                memory_total_mb=round(g.memoryTotal, 1),
                memory_percent=round(
                    g.memoryUsed / g.memoryTotal * 100, 1
                ) if g.memoryTotal > 0 else 0,
                temperature=g.temperature,
            ))
    except Exception:
        logger.debug("Failed to read GPU metrics", exc_info=True)
    return gpus


def get_gpu_detail_metrics(index: int = 0) -> GpuDetailMetrics:
    """Collect deep-dive GPU metrics for the given GPU index.

    Uses pynvml for NVIDIA GPUs (full data: power, fan, clocks, driver, PCIe).
    Falls back to GPUtil for AMD/Intel (load, VRAM, temperature only).
    """
    if PYNVML_AVAILABLE:
        try:
            pynvml.nvmlInit()
            count = pynvml.nvmlDeviceGetCount()
            if index >= count:
                index = 0
            handle = pynvml.nvmlDeviceGetHandleByIndex(index)

            name = pynvml.nvmlDeviceGetName(handle)
            if isinstance(name, bytes):
                name = name.decode("utf-8")

            uuid = pynvml.nvmlDeviceGetUUID(handle)
            if isinstance(uuid, bytes):
                uuid = uuid.decode("utf-8")

            driver = pynvml.nvmlSystemGetDriverVersion()
            if isinstance(driver, bytes):
                driver = driver.decode("utf-8")

            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            mem_total_mb = round(mem_info.total / (1024 * 1024), 1)
            mem_used_mb = round(mem_info.used / (1024 * 1024), 1)
            mem_percent = round(mem_used_mb / mem_total_mb * 100, 1) if mem_total_mb > 0 else 0.0

            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            load_percent = float(util.gpu)

            temperature = None
            try:
                temperature = float(pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU))
            except pynvml.NVMLError:
                pass

            fan_speed = None
            try:
                fan_speed = float(pynvml.nvmlDeviceGetFanSpeed(handle))
            except pynvml.NVMLError:
                pass

            power_draw = None
            try:
                power_draw = round(pynvml.nvmlDeviceGetPowerUsage(handle) / 1000.0, 1)
            except pynvml.NVMLError:
                pass

            power_limit = None
            try:
                power_limit = round(pynvml.nvmlDeviceGetEnforcedPowerLimit(handle) / 1000.0, 1)
            except pynvml.NVMLError:
                pass

            gpu_clock = None
            try:
                gpu_clock = int(pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_GRAPHICS))
            except pynvml.NVMLError:
                pass

            mem_clock = None
            try:
                mem_clock = int(pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_MEM))
            except pynvml.NVMLError:
                pass

            pcie_gen = None
            try:
                pcie_gen = int(pynvml.nvmlDeviceGetMaxPcieLinkGeneration(handle))
            except pynvml.NVMLError:
                pass

            pcie_width = None
            try:
                pcie_width = int(pynvml.nvmlDeviceGetMaxPcieLinkWidth(handle))
            except pynvml.NVMLError:
                pass

            pynvml.nvmlShutdown()

            return GpuDetailMetrics(
                index=index,
                name=name,
                uuid=uuid,
                driver_version=driver,
                memory_total_mb=mem_total_mb,
                pcie_gen=pcie_gen,
                pcie_width=pcie_width,
                load_percent=load_percent,
                memory_used_mb=mem_used_mb,
                memory_percent=mem_percent,
                temperature=temperature,
                fan_speed_percent=fan_speed,
                power_draw_watts=power_draw,
                power_limit_watts=power_limit,
                gpu_clock_mhz=gpu_clock,
                memory_clock_mhz=mem_clock,
            )

        except Exception:
            logger.debug("pynvml GPU detail failed, falling back to GPUtil", exc_info=True)
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass

    # GPUtil fallback (AMD / Intel / no pynvml)
    if GPU_AVAILABLE:
        try:
            gpu_list = GPUtil.getGPUs()
            if gpu_list and index < len(gpu_list):
                g = gpu_list[index]
                mem_total = round(g.memoryTotal, 1)
                mem_used = round(g.memoryUsed, 1)
                return GpuDetailMetrics(
                    index=index,
                    name=g.name,
                    memory_total_mb=mem_total,
                    load_percent=round(g.load * 100, 1),
                    memory_used_mb=mem_used,
                    memory_percent=round(mem_used / mem_total * 100, 1) if mem_total > 0 else 0.0,
                    temperature=g.temperature,
                )
        except Exception:
            logger.debug("GPUtil GPU detail fallback failed", exc_info=True)

    # No GPU data at all
    return GpuDetailMetrics(
        index=index,
        name="Unknown GPU",
        memory_total_mb=0.0,
        load_percent=0.0,
        memory_used_mb=0.0,
        memory_percent=0.0,
    )


def get_ram_metrics() -> RamMetrics:
    mem = psutil.virtual_memory()
    return RamMetrics(
        total_gb=round(mem.total / (1024**3), 2),
        used_gb=round(mem.used / (1024**3), 2),
        available_gb=round(mem.available / (1024**3), 2),
        usage_percent=mem.percent,
    )


_ram_static_info: dict | None = None

_FORM_FACTOR_MAP = {
    0: "Unknown", 1: "Other", 2: "SIP", 3: "DIP", 4: "ZIP",
    5: "SOJ", 6: "Proprietary", 7: "SIMM", 8: "DIMM", 9: "TSOP",
    10: "PGA", 11: "RIMM", 12: "SODIMM", 13: "SRIMM", 14: "SMD",
    15: "SSMP", 16: "QFP", 17: "TQFP", 18: "SOIC", 19: "LCC",
    20: "PLCC", 21: "BGA", 22: "FPBGA", 23: "LGA",
}

_MEM_TYPE_MAP = {
    0: "Unknown", 20: "DDR", 21: "DDR2", 22: "DDR2 FB-DIMM",
    24: "DDR3", 26: "DDR4", 30: "LPDDR4", 34: "DDR5", 35: "LPDDR5",
}


def _get_ram_static_info() -> dict:
    """Gather physical RAM slot info via WMI (cached after first call)."""
    global _ram_static_info
    if _ram_static_info is not None:
        return _ram_static_info

    info: dict = {
        "modules": [],
        "total_slots": 0,
        "used_slots": 0,
        "memory_type": None,
        "speed_mhz": None,
        "cas_latency": None,
    }

    if _WMI_AVAILABLE and _wmi_conn:
        try:
            modules = _wmi_conn.Win32_PhysicalMemory()
            slots = []
            for i, m in enumerate(modules):
                cap_bytes = int(m.Capacity or 0)
                cap_gb = round(cap_bytes / (1024**3), 1) if cap_bytes else 0

                mem_type_code = int(m.SMBIOSMemoryType or m.MemoryType or 0)
                mem_type_str = _MEM_TYPE_MAP.get(mem_type_code, None)

                ff_code = int(m.FormFactor or 0)
                ff_str = _FORM_FACTOR_MAP.get(ff_code, None)

                speed = int(m.ConfiguredClockSpeed or m.Speed or 0) if m.Speed else None
                manufacturer = (m.Manufacturer or "").strip() or None
                part = (m.PartNumber or "").strip() or None

                slots.append(RamSlotInfo(
                    slot=m.DeviceLocator or f"Slot {i}",
                    capacity_gb=cap_gb,
                    speed_mhz=speed,
                    manufacturer=manufacturer,
                    part_number=part,
                    form_factor=ff_str,
                    memory_type=mem_type_str,
                ))

                if mem_type_str and not info["memory_type"]:
                    info["memory_type"] = mem_type_str
                if speed and not info["speed_mhz"]:
                    info["speed_mhz"] = speed

            info["modules"] = slots
            info["used_slots"] = len(slots)

            try:
                arrays = _wmi_conn.Win32_PhysicalMemoryArray()
                if arrays:
                    info["total_slots"] = sum(
                        int(a.MemoryDevices or 0) for a in arrays
                    )
            except Exception:
                info["total_slots"] = len(slots)

            if info["total_slots"] < info["used_slots"]:
                info["total_slots"] = info["used_slots"]

        except Exception:
            logger.debug("Failed to read RAM slot info via WMI", exc_info=True)

    if not info["modules"]:
        info["total_slots"] = max(info["total_slots"], 1)

    _ram_static_info = info
    return _ram_static_info


def get_ram_detail_metrics() -> RamDetailMetrics:
    """Collect deep-dive RAM metrics including physical slots, usage breakdown."""
    static = _get_ram_static_info()
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    total_gb = round(mem.total / (1024**3), 2)
    used_gb = round(mem.used / (1024**3), 2)
    available_gb = round(mem.available / (1024**3), 2)

    cached_bytes = getattr(mem, "cached", 0) or 0
    cached_gb = round(cached_bytes / (1024**3), 2)

    commit_limit_gb = round((mem.total + swap.total) / (1024**3), 2)
    committed_gb = round((mem.used + swap.used) / (1024**3), 2)

    return RamDetailMetrics(
        total_slots=static["total_slots"],
        used_slots=static["used_slots"],
        modules=[m if isinstance(m, RamSlotInfo) else RamSlotInfo(**m) for m in static["modules"]],
        memory_type=static["memory_type"],
        speed_mhz=static["speed_mhz"],
        cas_latency=static["cas_latency"],
        total_gb=total_gb,
        used_gb=used_gb,
        available_gb=available_gb,
        cached_gb=cached_gb,
        committed_gb=committed_gb,
        commit_limit_gb=commit_limit_gb,
        usage_percent=mem.percent,
    )


def get_disk_metrics() -> list[DiskMetrics]:
    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append(DiskMetrics(
                device=part.device,
                mountpoint=part.mountpoint,
                total_gb=round(usage.total / (1024**3), 2),
                used_gb=round(usage.used / (1024**3), 2),
                free_gb=round(usage.free / (1024**3), 2),
                usage_percent=usage.percent,
            ))
        except (PermissionError, OSError):
            continue
    return disks


def get_network_metrics() -> NetworkMetrics:
    global _prev_net, _prev_net_time
    net = psutil.net_io_counters()
    now = time.time()

    sent_rate = 0.0
    recv_rate = 0.0
    if _prev_net is not None and _prev_net_time is not None:
        dt = now - _prev_net_time
        if dt > 0:
            sent_rate = (net.bytes_sent - _prev_net.bytes_sent) / dt
            recv_rate = (net.bytes_recv - _prev_net.bytes_recv) / dt

    _prev_net = net
    _prev_net_time = now

    return NetworkMetrics(
        bytes_sent=net.bytes_sent,
        bytes_recv=net.bytes_recv,
        bytes_sent_rate=round(sent_rate, 1),
        bytes_recv_rate=round(recv_rate, 1),
    )


def get_processes(include_icons: bool = True) -> list[ProcessInfo]:
    """Collect info for all running processes."""
    procs = []
    for p in psutil.process_iter(
        ["pid", "name", "status", "cpu_percent", "memory_info",
         "memory_percent", "io_counters", "username", "exe"]
    ):
        try:
            info = p.info
            io_counters = info.get("io_counters")
            exe_path = info.get("exe") or ""

            icon_b64 = None
            if include_icons and exe_path:
                icon_b64 = extract_icon_base64(exe_path)

            mem_info = info.get("memory_info")
            procs.append(ProcessInfo(
                pid=info["pid"],
                name=info["name"] or "Unknown",
                status=info.get("status", "unknown"),
                cpu_percent=round(info.get("cpu_percent", 0) or 0, 1),
                memory_mb=round(
                    (mem_info.rss / (1024 * 1024)) if mem_info else 0, 1
                ),
                memory_percent=round(info.get("memory_percent", 0) or 0, 1),
                disk_read_bytes=io_counters.read_bytes if io_counters else 0,
                disk_write_bytes=io_counters.write_bytes if io_counters else 0,
                username=info.get("username"),
                exe_path=exe_path,
                icon_base64=icon_b64,
            ))
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    return procs


def kill_process(pid: int) -> tuple[bool, str]:
    """Terminate a process by PID. Returns (success, message)."""
    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except psutil.TimeoutExpired:
            proc.kill()
        return True, f"Process '{name}' (PID {pid}) terminated"
    except psutil.NoSuchProcess:
        return False, f"PID {pid} not found"
    except psutil.AccessDenied:
        return False, f"Access denied for PID {pid}"
    except Exception as e:
        return False, str(e)


def collect_snapshot() -> SystemSnapshot:
    """Collect a full system snapshot including processes."""
    return SystemSnapshot(
        hostname=socket.gethostname(),
        platform=platform.system(),
        uptime_seconds=time.time() - psutil.boot_time(),
        cpu=get_cpu_metrics(),
        gpu=get_gpu_metrics(),
        ram=get_ram_metrics(),
        disks=get_disk_metrics(),
        network=get_network_metrics(),
        processes=get_processes(),
        timestamp=time.time(),
    )

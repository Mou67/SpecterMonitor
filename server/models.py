"""
Pydantic models for the Network Task Manager.
Supports multi-PC monitoring with full process listings.
"""
from pydantic import BaseModel
from typing import Optional


class CpuMetrics(BaseModel):
    usage_percent: float
    frequency_mhz: float
    cores_physical: int
    cores_logical: int
    per_core_usage: list[float]
    temperature: Optional[float] = None


class GpuMetrics(BaseModel):
    name: str
    load_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float
    temperature: Optional[float] = None


class RamMetrics(BaseModel):
    total_gb: float
    used_gb: float
    available_gb: float
    usage_percent: float


class DiskMetrics(BaseModel):
    device: str
    mountpoint: str
    total_gb: float
    used_gb: float
    free_gb: float
    usage_percent: float


class NetworkMetrics(BaseModel):
    bytes_sent: int
    bytes_recv: int
    bytes_sent_rate: float
    bytes_recv_rate: float


class ProcessInfo(BaseModel):
    pid: int
    name: str
    status: str
    cpu_percent: float
    memory_mb: float
    memory_percent: float
    disk_read_bytes: int
    disk_write_bytes: int
    username: Optional[str] = None
    exe_path: Optional[str] = None
    icon_base64: Optional[str] = None


class SystemSnapshot(BaseModel):
    hostname: str
    platform: str
    uptime_seconds: float
    cpu: CpuMetrics
    gpu: list[GpuMetrics]
    ram: RamMetrics
    disks: list[DiskMetrics]
    network: NetworkMetrics
    processes: list[ProcessInfo]
    timestamp: float


class HistoryPoint(BaseModel):
    timestamp: float
    cpu_percent: float
    ram_percent: float
    gpu_load: float
    gpu_temp: Optional[float] = None
    cpu_temp: Optional[float] = None
    net_sent_rate: float
    net_recv_rate: float


class CpuCoreDetail(BaseModel):
    core_id: int
    usage_percent: float
    frequency_mhz: float


class CpuDetailMetrics(BaseModel):
    # Identification
    model_name: str
    architecture: str
    stepping: Optional[str] = None
    revision: Optional[str] = None
    codename: Optional[str] = None
    vendor: str

    # Specifications
    cores_physical: int
    cores_logical: int
    l1_cache: Optional[str] = None
    l2_cache: Optional[str] = None
    l3_cache: Optional[str] = None
    base_frequency_mhz: float
    max_frequency_mhz: Optional[float] = None
    tdp_watts: Optional[int] = None

    # Live per-core data
    per_core_detail: list[CpuCoreDetail]
    overall_usage: float
    temperature: Optional[float] = None
    voltage: Optional[float] = None

    # Features / instruction sets
    features: list[str]


class RamSlotInfo(BaseModel):
    slot: str
    capacity_gb: float
    speed_mhz: Optional[int] = None
    manufacturer: Optional[str] = None
    part_number: Optional[str] = None
    form_factor: Optional[str] = None
    memory_type: Optional[str] = None


class RamDetailMetrics(BaseModel):
    # Physical hardware
    total_slots: int
    used_slots: int
    modules: list[RamSlotInfo]
    memory_type: Optional[str] = None  # DDR4, DDR5, etc.

    # Performance
    speed_mhz: Optional[int] = None
    cas_latency: Optional[str] = None

    # Live usage breakdown (GB)
    total_gb: float
    used_gb: float
    available_gb: float
    cached_gb: float
    committed_gb: float
    commit_limit_gb: float
    usage_percent: float

    # Paged/Non-paged pool (Windows)
    paged_pool_mb: Optional[float] = None
    non_paged_pool_mb: Optional[float] = None


class KillRequest(BaseModel):
    hostname: str
    pid: int


class KillResponse(BaseModel):
    success: bool
    message: str

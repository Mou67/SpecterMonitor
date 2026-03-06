export interface CpuMetrics {
  usage_percent: number;
  frequency_mhz: number;
  cores_physical: number;
  cores_logical: number;
  per_core_usage: number[];
  temperature: number | null;
}

export interface GpuMetrics {
  name: string;
  load_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_percent: number;
  temperature: number | null;
}

export interface RamMetrics {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  usage_percent: number;
}

export interface DiskMetrics {
  device: string;
  mountpoint: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  usage_percent: number;
}

export interface NetworkMetrics {
  bytes_sent: number;
  bytes_recv: number;
  bytes_sent_rate: number;
  bytes_recv_rate: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  status: string;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
  username: string | null;
  exe_path: string | null;
  icon_base64: string | null;
}

export interface HistoryPoint {
  timestamp: number;
  cpu_percent: number;
  ram_percent: number;
  gpu_load: number;
  gpu_temp: number | null;
  cpu_temp: number | null;
  net_sent_rate: number;
  net_recv_rate: number;
}

export interface HostSnapshot {
  hostname: string;
  platform: string;
  uptime_seconds: number;
  cpu: CpuMetrics;
  gpu: GpuMetrics[];
  ram: RamMetrics;
  disks: DiskMetrics[];
  network: NetworkMetrics;
  processes: ProcessInfo[];
  timestamp: number;
  history: HistoryPoint[];
}

export interface MultiHostPayload {
  hosts: Record<string, HostSnapshot>;
  timestamp: number;
}

export interface KillResult {
  type: "kill_result";
  success: boolean;
  message: string;
}

export interface CpuCoreDetail {
  core_id: number;
  usage_percent: number;
  frequency_mhz: number;
}

export interface CpuDetailMetrics {
  // Identification
  model_name: string;
  architecture: string;
  stepping: string | null;
  revision: string | null;
  codename: string | null;
  vendor: string;

  // Specifications
  cores_physical: number;
  cores_logical: number;
  l1_cache: string | null;
  l2_cache: string | null;
  l3_cache: string | null;
  base_frequency_mhz: number;
  max_frequency_mhz: number | null;
  tdp_watts: number | null;

  // Live per-core data
  per_core_detail: CpuCoreDetail[];
  overall_usage: number;
  temperature: number | null;
  voltage: number | null;

  // Features
  features: string[];
}

export interface RamSlotInfo {
  slot: string;
  capacity_gb: number;
  speed_mhz: number | null;
  manufacturer: string | null;
  part_number: string | null;
  form_factor: string | null;
  memory_type: string | null;
}

export interface RamDetailMetrics {
  // Physical hardware
  total_slots: number;
  used_slots: number;
  modules: RamSlotInfo[];
  memory_type: string | null;

  // Performance
  speed_mhz: number | null;
  cas_latency: string | null;

  // Live usage breakdown (GB)
  total_gb: number;
  used_gb: number;
  available_gb: number;
  cached_gb: number;
  committed_gb: number;
  commit_limit_gb: number;
  usage_percent: number;

  // Paged/Non-paged pool
  paged_pool_mb: number | null;
  non_paged_pool_mb: number | null;
}

export interface GpuDetailMetrics {
  index: number;
  name: string;
  uuid: string | null;
  driver_version: string | null;

  // Specs (mostly static)
  memory_total_mb: number;
  pcie_gen: number | null;
  pcie_width: number | null;

  // Live
  load_percent: number;
  memory_used_mb: number;
  memory_percent: number;
  temperature: number | null;
  fan_speed_percent: number | null;
  power_draw_watts: number | null;
  power_limit_watts: number | null;
  gpu_clock_mhz: number | null;
  memory_clock_mhz: number | null;
}

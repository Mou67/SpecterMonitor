"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Cpu, Clock } from "lucide-react";
import { HostSnapshot } from "@/types/metrics";
import CpuCard from "./CpuCard";
import GpuCard from "./GpuCard";
import RamCard from "./RamCard";
import NetworkCard from "./NetworkCard";
import DiskCard from "./DiskCard";
import CoreGrid from "./CoreGrid";
import MetricChart from "./MetricChart";
import ProcessTable from "./ProcessTable";
import CpuDetailOverlay from "./CpuDetailOverlay";
import RamDetailOverlay from "./RamDetailOverlay";

interface HostDetailProps {
  data: HostSnapshot;
  onKill: (pid: number) => void;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type Tab = "overview" | "processes";

export default function HostDetail({ data, onKill }: HostDetailProps) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      {/* Tab bar + host info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{data.hostname}</h2>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatUptime(data.uptime_seconds)}
          </span>
          <span className="text-xs text-gray-600">{data.platform}</span>
        </div>

        <div className="flex bg-white/[0.03] rounded-lg p-1 border border-white/5">
          <button
            onClick={() => setTab("overview")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === "overview"
                ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            <Activity className="w-3 h-3 inline mr-1.5" />
            Overview
          </button>
          <button
            onClick={() => setTab("processes")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === "processes"
                ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            <Cpu className="w-3 h-3 inline mr-1.5" />
            Processes ({data.processes.length})
          </button>
        </div>
      </div>

      {tab === "overview" ? (
        <OverviewTab data={data} />
      ) : (
        <ProcessTable
          processes={data.processes}
          onKill={onKill}
        />
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: HostSnapshot }) {
  const [cpuDetailOpen, setCpuDetailOpen] = useState(false);
  const [ramDetailOpen, setRamDetailOpen] = useState(false);

  return (
    <>
      <CpuDetailOverlay
        isOpen={cpuDetailOpen}
        onClose={() => setCpuDetailOpen(false)}
      />
      <RamDetailOverlay
        isOpen={ramDetailOpen}
        onClose={() => setRamDetailOpen(false)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <CpuCard cpu={data.cpu} onClick={() => setCpuDetailOpen(true)} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <RamCard ram={data.ram} onClick={() => setRamDetailOpen(true)} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {data.gpu.length > 0 ? (
            <GpuCard gpu={data.gpu[0]} />
          ) : (
            <div className="glass-card p-6 h-full flex flex-col items-center justify-center text-gray-500">
              <Cpu className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No GPU detected</p>
            </div>
          )}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <NetworkCard network={data.network} />
        </motion.div>

        {/* Charts */}
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MetricChart
            history={data.history || []}
            dataKeys={[
              { key: "cpu_percent", color: "#00f0ff", label: "CPU %" },
              { key: "ram_percent", color: "#ff00e5", label: "RAM %" },
            ]}
            title="CPU & RAM Usage"
            icon={<Activity className="w-4 h-4" />}
            yDomain={[0, 100]}
            unit="%"
          />
        </motion.div>
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <MetricChart
            history={data.history || []}
            dataKeys={[
              { key: "gpu_load", color: "#39ff14", label: "GPU Load %" },
              ...((data.history || []).some((h) => h.gpu_temp != null)
                ? [{ key: "gpu_temp" as const, color: "#ff6a00", label: "GPU Temp" }]
                : []),
              ...((data.history || []).some((h) => h.cpu_temp != null)
                ? [{ key: "cpu_temp" as const, color: "#ff073a", label: "CPU Temp" }]
                : []),
            ]}
            title="GPU & Temperatures"
            icon={<Cpu className="w-4 h-4" />}
            yDomain={[0, 100]}
            unit=""
          />
        </motion.div>

        {/* Core grid + Disks */}
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <CoreGrid cores={data.cpu.per_core_usage} />
        </motion.div>
        <motion.div
          className="md:col-span-2"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <DiskCard disks={data.disks} />
        </motion.div>
      </div>
    </>
  );
}

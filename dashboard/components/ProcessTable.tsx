"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Skull,
  AlertTriangle,
} from "lucide-react";
import { ProcessInfo } from "@/types/metrics";

interface ProcessTableProps {
  processes: ProcessInfo[];
  onKill: (pid: number) => void;
}

type SortKey = "name" | "cpu_percent" | "memory_mb" | "memory_percent" | "disk_read_bytes" | "status";
type SortDir = "asc" | "desc";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function statusColor(status: string): string {
  switch (status) {
    case "running":
      return "#39ff14";
    case "sleeping":
      return "#555";
    case "stopped":
      return "#ff6a00";
    case "zombie":
      return "#ff073a";
    default:
      return "#444";
  }
}

const COLUMNS: { key: SortKey; label: string; width: string; align?: string }[] = [
  { key: "name", label: "Name", width: "flex-1 min-w-[200px]" },
  { key: "status", label: "Status", width: "w-20" },
  { key: "cpu_percent", label: "CPU %", width: "w-20", align: "text-right" },
  { key: "memory_mb", label: "RAM", width: "w-24", align: "text-right" },
  { key: "memory_percent", label: "RAM %", width: "w-20", align: "text-right" },
  { key: "disk_read_bytes", label: "Disk I/O", width: "w-24", align: "text-right" },
];

export default function ProcessTable({ processes, onKill }: ProcessTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cpu_percent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [killConfirm, setKillConfirm] = useState<number | null>(null);
  const prevCpuMap = useRef<Map<number, number>>(new Map());

  // Track CPU changes for flash effects
  const cpuFlashSet = useMemo(() => {
    const flashing = new Set<number>();
    processes.forEach((p) => {
      const prev = prevCpuMap.current.get(p.pid) ?? 0;
      if (p.cpu_percent - prev > 10) {
        flashing.add(p.pid);
      }
    });
    // Update prev map
    const newMap = new Map<number, number>();
    processes.forEach((p) => newMap.set(p.pid, p.cpu_percent));
    prevCpuMap.current = newMap;
    return flashing;
  }, [processes]);

  const filtered = useMemo(() => {
    let list = processes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.username && p.username.toLowerCase().includes(q)) ||
          String(p.pid).includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let aVal: string | number = a[sortKey] as string | number;
      let bVal: string | number = b[sortKey] as string | number;
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [processes, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleKill = (pid: number) => {
    if (killConfirm === pid) {
      onKill(pid);
      setKillConfirm(null);
    } else {
      setKillConfirm(pid);
      setTimeout(() => setKillConfirm(null), 3000);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b border-white/5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search processes... (Name, PID, User)"
            className="w-full bg-white/[0.03] border border-white/5 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/30 focus:ring-1 focus:ring-neon-cyan/20 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {filtered.length} of {processes.length} processes
          </span>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02] border-b border-white/5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
        <div className="w-8" /> {/* Icon */}
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => handleSort(col.key)}
            className={`${col.width} ${col.align || ""} flex items-center gap-1 hover:text-white transition-colors cursor-pointer select-none ${
              col.align === "text-right" ? "justify-end" : ""
            }`}
          >
            {col.label}
            {sortKey === col.key && (
              sortDir === "desc" ? (
                <ChevronDown className="w-3 h-3 text-neon-cyan" />
              ) : (
                <ChevronUp className="w-3 h-3 text-neon-cyan" />
              )
            )}
          </button>
        ))}
        <div className="w-10" /> {/* Kill button space */}
      </div>

      {/* Process Rows */}
      <div className="max-h-[600px] overflow-y-auto">
        <LayoutGroup>
          <AnimatePresence initial={false}>
            {filtered.map((proc) => (
              <motion.div
                key={proc.pid}
                layout
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  backgroundColor: cpuFlashSet.has(proc.pid)
                    ? ["rgba(0,240,255,0)", "rgba(0,240,255,0.08)", "rgba(0,240,255,0)"]
                    : "rgba(0,0,0,0)",
                }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  layout: { type: "spring", damping: 30, stiffness: 400 },
                  opacity: { duration: 0.2 },
                  backgroundColor: { duration: 1 },
                }}
                className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.02] hover:bg-white/[0.03] group transition-colors"
              >
                {/* Process Icon */}
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  {proc.icon_base64 ? (
                    <img
                      src={`data:image/png;base64,${proc.icon_base64}`}
                      alt=""
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center">
                      <span className="text-[8px] text-gray-600 font-mono">
                        {proc.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-[200px] truncate">
                  <span className="text-sm text-white">{proc.name}</span>
                  <span className="text-[10px] text-gray-600 ml-2">
                    PID {proc.pid}
                  </span>
                </div>

                {/* Status */}
                <div className="w-20">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: statusColor(proc.status) }}
                    />
                    <span className="text-xs text-gray-400 capitalize">
                      {proc.status}
                    </span>
                  </span>
                </div>

                {/* CPU % */}
                <div className="w-20 text-right">
                  <motion.span
                    className="text-xs font-mono"
                    animate={{
                      color:
                        proc.cpu_percent > 50
                          ? "#ff073a"
                          : proc.cpu_percent > 20
                          ? "#ff6a00"
                          : proc.cpu_percent > 5
                          ? "#00f0ff"
                          : "#666",
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {proc.cpu_percent.toFixed(1)}
                  </motion.span>
                </div>

                {/* Memory MB */}
                <div className="w-24 text-right">
                  <span className="text-xs font-mono text-gray-300">
                    {proc.memory_mb >= 1024
                      ? `${(proc.memory_mb / 1024).toFixed(1)} GB`
                      : `${proc.memory_mb.toFixed(0)} MB`}
                  </span>
                </div>

                {/* Memory % */}
                <div className="w-20 text-right">
                  <span className="text-xs font-mono text-gray-400">
                    {proc.memory_percent.toFixed(1)}
                  </span>
                </div>

                {/* Disk I/O */}
                <div className="w-24 text-right">
                  <span className="text-[10px] font-mono text-gray-500">
                    {formatBytes(proc.disk_read_bytes + proc.disk_write_bytes)}
                  </span>
                </div>

                {/* Kill Button */}
                <div className="w-10 flex justify-center">
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleKill(proc.pid);
                    }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md ${
                      killConfirm === proc.pid
                        ? "bg-red-500/20 text-red-400 opacity-100"
                        : "hover:bg-red-500/10 text-gray-500 hover:text-red-400"
                    }`}
                    title={
                      killConfirm === proc.pid
                        ? "Click again to confirm"
                        : "Kill Process"
                    }
                  >
                    {killConfirm === proc.pid ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Skull className="w-3.5 h-3.5" />
                    )}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </div>
  );
}

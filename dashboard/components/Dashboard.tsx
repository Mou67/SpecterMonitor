"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Clock, Layers } from "lucide-react";
import { HostSnapshot } from "@/types/metrics";
import HostCard from "./HostCard";
import HostDetail from "./HostDetail";

interface DashboardProps {
  hosts: Record<string, HostSnapshot>;
  connected: boolean;
  onKill: (hostname: string, pid: number) => void;
}

export default function Dashboard({ hosts, connected, onKill }: DashboardProps) {
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const hostnames = Object.keys(hosts);

  if (hostnames.length === 0) return null;

  // Auto-select first host if none selected
  const activeHost = selectedHost && hosts[selectedHost] ? selectedHost : hostnames[0];
  const activeData = hosts[activeHost];

  return (
    <div className="px-4 py-6 md:px-8 lg:px-12 max-w-[1920px] mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(0,240,255,0.15), rgba(255,0,229,0.15))",
              border: "1px solid rgba(0,240,255,0.2)",
            }}
          >
            <Monitor className="w-6 h-6 text-neon-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Network Task Manager
            </h1>
            <p className="text-sm text-gray-500">
              <Layers className="w-3 h-3 inline mr-1" />
              {hostnames.length} Host{hostnames.length !== 1 ? "s" : ""} verbunden
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: connected ? "#39ff14" : "#ff073a" }}
              animate={{
                boxShadow: connected
                  ? ["0 0 4px #39ff14", "0 0 12px #39ff14", "0 0 4px #39ff14"]
                  : ["0 0 4px #ff073a", "0 0 12px #ff073a", "0 0 4px #ff073a"],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span>{connected ? "Live" : "Offline"}</span>
          </div>
        </div>
      </motion.header>

      {/* Host Cards Row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6"
      >
        <AnimatePresence>
          {hostnames.map((hostname, i) => (
            <motion.div
              key={hostname}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                type: "spring",
                damping: 20,
                stiffness: 300,
                delay: i * 0.08,
              }}
            >
              <HostCard
                data={hosts[hostname]}
                isSelected={hostname === activeHost}
                onClick={() => setSelectedHost(hostname)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Detail View for selected host */}
      <AnimatePresence mode="wait">
        {activeData && (
          <motion.div
            key={activeHost}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
          >
            <HostDetail
              data={activeData}
              onKill={(pid) => onKill(activeHost, pid)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

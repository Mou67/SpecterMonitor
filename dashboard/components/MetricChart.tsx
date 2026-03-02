"use client";

import { ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { HistoryPoint } from "@/types/metrics";

interface DataKeyConfig {
  key: string;
  color: string;
  label: string;
}

interface MetricChartProps {
  history: HistoryPoint[];
  dataKeys: DataKeyConfig[];
  title: string;
  icon: ReactNode;
  yDomain?: [number, number];
  unit?: string;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function MetricChart({
  history,
  dataKeys,
  title,
  icon,
  yDomain,
  unit = "",
}: MetricChartProps) {
  const chartData = history.map((h) => ({
    ...h,
    time: formatTime(h.timestamp),
  }));

  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: "rgba(255, 255, 255, 0.05)" }}
        >
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>

        <div className="ml-auto flex items-center gap-3">
          {dataKeys.map((dk) => (
            <div key={dk.key} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: dk.color }}
              />
              <span className="text-[10px] text-gray-400">{dk.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              {dataKeys.map((dk) => (
                <linearGradient key={dk.key} id={`grad-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={dk.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={dk.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#555" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 10, fill: "#555" }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 15, 30, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
              labelStyle={{ color: "#888", marginBottom: 4 }}
              formatter={(value: number, name: string) => {
                const dk = dataKeys.find((d) => d.key === name);
                return [`${value.toFixed(1)}${unit}`, dk?.label || name];
              }}
            />
            {dataKeys.map((dk) => (
              <Area
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                stroke={dk.color}
                strokeWidth={2}
                fill={`url(#grad-${dk.key})`}
                dot={false}
                animationDuration={500}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

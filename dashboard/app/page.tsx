"use client";

import { useMonitorWebSocket } from "@/hooks/useWebSocket";
import Dashboard from "@/components/Dashboard";
import ConnectionOverlay from "@/components/ConnectionOverlay";
import KillToast from "@/components/KillToast";

export default function Home() {
  const { hosts, connected, sendKill, killResult } = useMonitorWebSocket();

  return (
    <main className="relative z-10 min-h-screen">
      {!connected && <ConnectionOverlay />}
      <Dashboard hosts={hosts} connected={connected} onKill={sendKill} />
      <KillToast result={killResult} />
    </main>
  );
}

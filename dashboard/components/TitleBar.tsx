"use client";

import { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";

export default function TitleBar() {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.isElectron) return;

    setIsElectron(true);
    api.onMaximizedChange?.((maximized: boolean) => {
      setIsMaximized(maximized);
    });
  }, []);

  if (!isElectron) return null;

  const api = (window as any).electronAPI;

  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <span className="titlebar-dot" />
        SpecterMonitor
      </div>

      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          onClick={() => api.minimize()}
          aria-label="Minimize"
        >
          <Minus size={14} strokeWidth={2} />
        </button>

        <button
          className="titlebar-btn"
          onClick={() => api.maximize()}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={2} />
          ) : (
            <Square size={12} strokeWidth={2} />
          )}
        </button>

        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={() => api.close()}
          aria-label="Close"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

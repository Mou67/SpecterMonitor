"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { KillResult } from "@/types/metrics";

export default function KillToast({ result }: { result: KillResult | null }) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50 glass-card px-5 py-4 flex items-center gap-3 max-w-sm"
          style={{
            borderColor: result.success
              ? "rgba(57, 255, 20, 0.2)"
              : "rgba(255, 7, 58, 0.2)",
          }}
        >
          {result.success ? (
            <CheckCircle className="w-5 h-5 text-neon-green shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-neon-red shrink-0" />
          )}
          <span className="text-sm text-gray-200">{result.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

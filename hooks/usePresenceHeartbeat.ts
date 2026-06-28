"use client";

import { useEffect, useRef } from "react";

/** Heartbeat interval in ms (every 2 minutes) */
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

/**
 * usePresenceHeartbeat — Periodically pings the server to keep
 * the user's `last_active_at` timestamp fresh for "Informants Online" count.
 *
 * Uses a lightweight POST to /api/presence that updates the informants row.
 */
export function usePresenceHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function sendHeartbeat() {
      fetch("/api/presence", { method: "POST", credentials: "include" }).catch(() => {
        // Silently ignore — non-critical
      });
    }

    // Send immediately on mount
    sendHeartbeat();

    // Then repeat every 2 minutes
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}

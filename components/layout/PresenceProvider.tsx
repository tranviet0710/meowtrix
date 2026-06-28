"use client";

import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";

/**
 * PresenceProvider — Client component that keeps the user's presence alive.
 * Renders nothing visible; just starts the heartbeat hook.
 */
export function PresenceProvider() {
  usePresenceHeartbeat();
  return null;
}

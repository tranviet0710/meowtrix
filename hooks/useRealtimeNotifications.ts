"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RealtimeNotification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

interface UseRealtimeNotificationsOptions {
  userId: string | null;
  onNewNotification?: (notification: RealtimeNotification) => void;
}

/**
 * Hook to subscribe to real-time notifications for a user via Supabase Realtime.
 * Listens for INSERT events on the `notifications` table filtered by recipient_id.
 *
 * Notes on channel lifecycle:
 * - `supabase.channel(topic)` returns an existing channel if one with the same
 *   topic is still registered on the client. Attempting to add a
 *   `postgres_changes` handler on an already-joined channel throws
 *   "cannot add `postgres_changes` callbacks ... after `subscribe()`".
 *   This can happen in React Strict Mode (double effect) or after a page
 *   reload in Safari where the browser client is memoized. To avoid it we
 *   generate a unique topic per hook invocation.
 * - The `onNewNotification` callback is kept in a ref so a new function
 *   identity from the parent does not tear down and rebuild the subscription.
 */
export function useRealtimeNotifications({
  userId,
  onNewNotification,
}: UseRealtimeNotificationsOptions) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<RealtimeNotification | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Keep the latest callback in a ref so effect re-runs are driven only by userId.
  const onNewNotificationRef = useRef(onNewNotification);
  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Use a unique topic per subscription to avoid reusing an already-joined
    // channel from a previous mount / Strict Mode double-invoke / Safari reload.
    const uniqueSuffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const topic = `notifications:${userId}:${uniqueSuffix}`;

    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as RealtimeNotification;
          setLatestNotification(newNotification);
          setUnreadCount((prev) => prev + 1);
          onNewNotificationRef.current?.(newNotification);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Fetch initial unread count
    async function fetchUnreadCount() {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", userId!)
        .eq("read", false);

      setUnreadCount(count ?? 0);
    }

    fetchUnreadCount();

    return () => {
      if (channelRef.current) {
        // removeChannel unsubscribes AND removes the channel from the client's
        // registry so a fresh channel with the same topic can be created.
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return { unreadCount, latestNotification, setUnreadCount };
}

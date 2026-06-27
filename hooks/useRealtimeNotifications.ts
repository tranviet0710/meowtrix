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
 */
export function useRealtimeNotifications({
  userId,
  onNewNotification,
}: UseRealtimeNotificationsOptions) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<RealtimeNotification | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to new notifications for this user
    const channel = supabase
      .channel(`notifications:${userId}`)
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
          onNewNotification?.(newNotification);
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
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, onNewNotification]);

  return { unreadCount, latestNotification, setUnreadCount };
}

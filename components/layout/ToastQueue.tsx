"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import type { Notification } from "@/types";

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5000;

interface ToastItem {
  id: string;
  notification: Notification;
  enterAt: number;
}

export function ToastQueue() {
  const [visibleToasts, setVisibleToasts] = useState<ToastItem[]>([]);
  const queueRef = useRef<ToastItem[]>([]);
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const promoteFromQueue = useCallback(() => {
    setVisibleToasts((current) => {
      if (current.length >= MAX_VISIBLE || queueRef.current.length === 0) {
        return current;
      }

      const slotsAvailable = MAX_VISIBLE - current.length;
      const promoted = queueRef.current.splice(0, slotsAvailable);
      return [...current, ...promoted];
    });
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      const timer = dismissTimersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        dismissTimersRef.current.delete(id);
      }

      setVisibleToasts((current) => current.filter((t) => t.id !== id));

      // After state update, promote from queue on next tick
      setTimeout(promoteFromQueue, 50);
    },
    [promoteFromQueue]
  );

  // Set up auto-dismiss timers for visible toasts
  useEffect(() => {
    for (const toast of visibleToasts) {
      if (!dismissTimersRef.current.has(toast.id)) {
        const timer = setTimeout(() => {
          dismissToast(toast.id);
        }, AUTO_DISMISS_MS);
        dismissTimersRef.current.set(toast.id, timer);
      }
    }
  }, [visibleToasts, dismissToast]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of dismissTimersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const addNotification = useCallback(
    (notification: Notification) => {
      const toastItem: ToastItem = {
        id: notification.id,
        notification,
        enterAt: Date.now(),
      };

      setVisibleToasts((current) => {
        if (current.length < MAX_VISIBLE) {
          return [...current, toastItem];
        }
        // Queue overflow — FIFO
        queueRef.current.push(toastItem);
        return current;
      });
    },
    []
  );

  // Subscribe to Supabase Realtime for live notifications
  useEffect(() => {
    const supabase = createClient();
    let userId: string | null = null;

    async function setupSubscription() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

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
            const newNotification = payload.new as Notification;
            addNotification(newNotification);
          }
        )
        .subscribe();

      return channel;
    }

    const channelPromise = setupSubscription();

    return () => {
      channelPromise.then((channel) => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, [addNotification]);

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "match_alert":
        return "🎯";
      case "escalation":
        return "🚨";
      case "claim_initiated":
        return "📧";
      case "claim_verified":
        return "✅";
      case "claim_rejected":
        return "❌";
      case "claim_reminder":
        return "⏰";
      case "claim_reverted":
        return "↩️";
      case "overlord_resolved":
        return "🏠";
      case "search_concluded":
        return "⏱️";
      default:
        return "📡";
    }
  };

  const getTransmissionLabel = (type: Notification["type"]) => {
    switch (type) {
      case "match_alert":
        return "Possible Match";
      case "escalation":
        return "Search Update";
      case "claim_initiated":
        return "Claim Started";
      case "claim_verified":
        return "Claim Verified";
      case "claim_rejected":
        return "Claim Declined";
      case "claim_reminder":
        return "Action Needed";
      case "claim_reverted":
        return "Claim Reverted";
      case "overlord_resolved":
        return "Pet Recovered";
      case "search_concluded":
        return "Search Ended";
      default:
        return "New Notification";
    }
  };

  if (visibleToasts.length === 0) return null;

  return (
    <div
      className="
        fixed right-4 z-[60]
        bottom-24 md:bottom-6
        flex flex-col-reverse gap-2
        pointer-events-none
        max-w-[calc(100vw-2rem)] w-80
      "
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className="
            group
            pointer-events-auto
            bg-card border border-border
            rounded-xl p-3.5
            shadow-[var(--shadow-lg)]
            animate-in slide-in-from-right-5 fade-in duration-300
            relative overflow-hidden
          "
          role="alert"
          title={`${toast.notification.title}\n${toast.notification.body}`}
        >
          {/* Soft top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-primary">
              {getNotificationIcon(toast.notification.type)}{" "}
              {getTransmissionLabel(toast.notification.type)}
            </span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="
                text-text-secondary hover:text-text-primary
                text-xs leading-none p-1
                min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0
                flex items-center justify-center
              "
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>

          {/* Title */}
          <p
            className="text-sm font-semibold text-text-primary truncate group-hover:whitespace-normal group-hover:overflow-visible"
            title={toast.notification.title}
          >
            {toast.notification.title}
          </p>

          {/* Body */}
          <p
            className="text-xs text-text-secondary mt-0.5 line-clamp-2 group-hover:line-clamp-none"
            title={toast.notification.body}
          >
            {toast.notification.body}
          </p>

          {/* Progress bar for auto-dismiss */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border">
            <div
              className="h-full bg-accent/60 animate-shrink-width"
              style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

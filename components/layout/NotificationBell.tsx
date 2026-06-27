"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRealtimeNotifications, type RealtimeNotification } from "@/hooks/useRealtimeNotifications";
import { createClient } from "@/lib/supabaseClient";

/**
 * NotificationBell — Real-time notification indicator.
 * Shows unread count badge and displays a toast-like popup when new notifications arrive.
 * Uses Supabase Realtime to listen for new match alerts.
 */
export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupNotification, setPopupNotification] = useState<RealtimeNotification | null>(null);

  // Get current user ID
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    getUser();
  }, []);

  const handleNewNotification = useCallback((notification: RealtimeNotification) => {
    setPopupNotification(notification);
    setShowPopup(true);

    // Auto-hide popup after 5 seconds
    setTimeout(() => {
      setShowPopup(false);
    }, 5000);
  }, []);

  const { unreadCount } = useRealtimeNotifications({
    userId,
    onNewNotification: handleNewNotification,
  });

  return (
    <div className="relative">
      {/* Bell icon with badge */}
      <button
        type="button"
        className="relative flex items-center justify-center min-w-[44px] min-h-[44px] text-sidebar-text hover:text-accent transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Real-time popup notification */}
      {showPopup && popupNotification && (
        <div className="absolute right-0 top-12 z-50 w-72 border-[3px] border-accent bg-card p-4 shadow-[4px_4px_0px_var(--color-accent)] animate-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase text-accent">
                {popupNotification.title}
              </p>
              <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                {popupNotification.body}
              </p>
            </div>
            <button
              onClick={() => setShowPopup(false)}
              className="text-text-secondary hover:text-text-primary text-lg leading-none"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X, Check } from "lucide-react";
import { useRealtimeNotifications, type RealtimeNotification } from "@/hooks/useRealtimeNotifications";
import { createClient } from "@/lib/supabaseClient";
import Link from "next/link";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

/**
 * NotificationBell — Real-time notification indicator with dropdown panel.
 * Shows unread count badge, displays real-time popups, and provides
 * a clickable dropdown to view and manage past notifications.
 * Uses fixed positioning to avoid sidebar overflow clipping.
 */
export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [popupNotification, setPopupNotification] = useState<RealtimeNotification | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Get current user ID
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    getUser();
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        bellRef.current && !bellRef.current.contains(target)
      ) {
        setShowPanel(false);
      }
    }

    if (showPanel) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPanel]);

  // Close panel on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowPanel(false);
      }
    }

    if (showPanel) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showPanel]);

  const handleNewNotification = useCallback((notification: RealtimeNotification) => {
    setPopupNotification(notification);
    setShowPopup(true);

    // Add to notifications list
    setNotifications((prev) => [
      {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata,
        read: false,
        created_at: notification.created_at,
      },
      ...prev,
    ]);

    // Auto-hide popup after 5 seconds
    setTimeout(() => {
      setShowPopup(false);
    }, 5000);
  }, []);

  const { unreadCount, setUnreadCount } = useRealtimeNotifications({
    userId,
    onNewNotification: handleNewNotification,
  });

  // Fetch notifications when panel opens
  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const response = await fetch("/api/notifications?limit=20");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Silent fail — non-critical
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  function handleBellClick() {
    setShowPanel((prev) => {
      const opening = !prev;
      if (opening) {
        fetchNotifications();
      }
      return opening;
    });
    setShowPopup(false);
  }

  // Mark all as read
  async function handleMarkAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      // Silent fail
    }
  }

  // Get match link from notification metadata
  function getNotificationLink(notification: NotificationItem): string | null {
    if (notification.metadata?.match_suggestion_id) {
      return `/matches/${notification.metadata.match_suggestion_id}`;
    }
    return null;
  }

  // Format relative time
  function formatTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
  }

  // Calculate panel position based on bell button location
  function getPanelStyle(): React.CSSProperties {
    if (!bellRef.current) return { top: 0, left: 0 };
    const rect = bellRef.current.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - 320), // 320px = panel width, keep within viewport
    };
  }

  return (
    <div className="relative">
      {/* Bell icon with badge */}
      <button
        ref={bellRef}
        type="button"
        onClick={handleBellClick}
        className="relative flex items-center justify-center min-w-[44px] min-h-[44px] text-sidebar-text hover:text-accent transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={showPanel}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification dropdown panel — fixed position to avoid sidebar overflow clipping */}
      {showPanel && (
        <div
          ref={panelRef}
          style={getPanelStyle()}
          className="z-[9999] w-80 max-h-[420px] flex flex-col rounded-xl border border-border bg-card shadow-[var(--shadow-lg)] animate-in slide-in-from-top-2 overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-semibold text-sm text-text-primary">
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-secondary hover:text-primary transition-colors"
                  aria-label="Mark all as read"
                >
                  <Check className="h-3 w-3" />
                  Read all
                </button>
              )}
              <button
                onClick={() => setShowPanel(false)}
                className="flex items-center justify-center min-w-[28px] min-h-[28px] text-text-secondary hover:text-text-primary transition-colors rounded-md"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingNotifications ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-xs text-text-secondary animate-pulse">
                  Loading…
                </span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Bell className="h-8 w-8 text-text-secondary/40 mb-2" />
                <p className="text-xs text-text-secondary text-center">
                  No notifications yet
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-sidebar-border" role="list" aria-label="Notifications list">
                {notifications.map((notification) => {
                  const link = getNotificationLink(notification);
                  const fullTooltip = `${notification.title}\n${notification.body}`;
                  const content = (
                    <div
                      className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary/5 ${!notification.read ? "bg-primary/5" : ""}`}
                      title={fullTooltip}
                    >
                      {/* Unread indicator */}
                      <div className="pt-1.5 flex-shrink-0">
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                        {notification.read && <div className="h-2 w-2" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold text-text-primary truncate group-hover:whitespace-normal group-hover:overflow-visible"
                          title={notification.title}
                        >
                          {notification.title}
                        </p>
                        <p
                          className="mt-0.5 text-xs text-text-secondary line-clamp-2 group-hover:line-clamp-none leading-relaxed"
                          title={notification.body}
                        >
                          {notification.body}
                        </p>
                        <p className="mt-1 text-[10px] text-text-secondary/60">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <li key={notification.id}>
                      {link ? (
                        <Link href={link} onClick={() => setShowPanel(false)}>
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Real-time popup notification (shows even when panel is closed) */}
      {showPopup && popupNotification && !showPanel && (
        <div
          style={getPanelStyle()}
          className="group z-[9999] w-72 rounded-xl border border-primary/40 bg-card p-4 shadow-[var(--shadow-lg)] animate-in slide-in-from-top-2"
          title={`${popupNotification.title}\n${popupNotification.body}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold text-primary"
                title={popupNotification.title}
              >
                {popupNotification.title}
              </p>
              <p
                className="mt-1 text-xs text-text-secondary line-clamp-2 group-hover:line-clamp-none"
                title={popupNotification.body}
              >
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

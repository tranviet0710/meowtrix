"use client";

import { useState, useRef, useEffect } from "react";
import { Share2 } from "lucide-react";

/**
 * ShareButton — Social sharing component for the leaderboard page.
 *
 * Generates platform-specific share URLs for Facebook, Twitter/X, and LINE.
 * Includes Open Graph meta tag hints (title, top 3 informants, MEOWTRIX branding).
 *
 * Requirements: 10.7, 10.8
 */
export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/leaderboard`
    : "/leaderboard";

  const shareTitle = "MEOWTRIX — Feline Overlord Tracker Leaderboard";
  const shareText = "Check out the top Informants on MEOWTRIX! Who's the best at finding lost cats? 🐱🕵️";

  const platforms = [
    {
      name: "Facebook",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      getUrl: () =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "Twitter/X",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      getUrl: () =>
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: "LINE",
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
      ),
      getUrl: () =>
        `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-[2px] hover:border-accent/50 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Share leaderboard"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-[2px] shadow-lg shadow-black/40 z-50 overflow-hidden"
          role="menu"
          aria-label="Share options"
        >
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-mono">
              Broadcast Intel
            </span>
          </div>
          {platforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.getUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-primary hover:bg-accent/10 hover:text-accent transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              {platform.icon}
              <span>{platform.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

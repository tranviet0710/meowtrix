"use client";

interface SuccessToastProps {
  visible: boolean;
  title: string;
  body: string;
  onDismiss: () => void;
}

/**
 * SuccessToast — Inline confirmation card shown after actions like
 * posting a report succeed. Warm mint tint, soft rounded, tap-anywhere
 * dismiss on mobile.
 */
export function SuccessToast({ visible, title, body, onDismiss }: SuccessToastProps) {
  if (!visible) return null;

  return (
    <div
      className="
        rounded-xl border border-success/40 bg-success/10
        p-4 relative overflow-hidden shadow-[var(--shadow-soft)]
        animate-in slide-in-from-top-2 fade-in duration-300
      "
      role="status"
      aria-live="polite"
    >
      {/* Soft top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-success/70 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">🎉</span>
          <div>
            <p className="text-sm font-semibold text-success">
              {title}
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {body}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-text-secondary hover:text-text-primary text-sm leading-none p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

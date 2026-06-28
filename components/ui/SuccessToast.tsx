"use client";

interface SuccessToastProps {
  visible: boolean;
  title: string;
  body: string;
  onDismiss: () => void;
}

/**
 * SuccessToast — Inline success confirmation styled as an "incoming transmission".
 * Used after report submissions to give clear feedback.
 */
export function SuccessToast({ visible, title, body, onDismiss }: SuccessToastProps) {
  if (!visible) return null;

  return (
    <div
      className="
        rounded-[2px] border border-success/50 bg-success/10
        p-4 relative overflow-hidden
        animate-in slide-in-from-top-2 fade-in duration-300
      "
      role="status"
      aria-live="polite"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-success to-transparent opacity-80" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-lg" aria-hidden="true">✅</span>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-success font-bold">
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
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

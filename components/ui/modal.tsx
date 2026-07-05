"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Modal — minimal, reusable dialog primitive.
 *
 * Renders through a portal on `document.body` when `open === true`, with:
 * - `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` / `aria-describedby`.
 * - Backdrop click and ESC key both call `onClose`.
 * - Basic focus trap: Tab / Shift+Tab cycle through focusable descendants.
 * - Body scroll lock while open (restored on close/unmount).
 * - Initial focus moves to `initialFocusRef.current`, else the first focusable
 *   descendant, else the modal container.
 * - On close, focus is restored to whatever was focused before the modal opened.
 *
 * Uses design tokens only: `bg-card`, `border-border`, `text-primary`,
 * `rounded-lg`, `shadow-md`. Callers style their own content inside `children`.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  children: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

function getFocusableDescendants(root: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  return nodes.filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // Skip elements that are visually hidden. offsetParent is null for
    // display:none subtrees; that's the common case we need to filter.
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") {
      return false;
    }
    return true;
  });
}

export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
  initialFocusRef,
  className,
}: ModalProps) {
  const autoLabelId = React.useId();
  const resolvedLabelledBy = labelledBy ?? autoLabelId;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // Guard SSR: only render the portal after mount so `document` is defined.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock while open.
  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Remember previously focused element and move focus into the modal on open.
  // Restore focus to that element when the modal closes or unmounts.
  React.useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Defer so children have mounted and refs are populated.
    const timer = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const target =
        initialFocusRef?.current ??
        getFocusableDescendants(container)[0] ??
        container;
      target.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === "function") {
        // Guard: only restore focus if the element is still in the DOM.
        if (document.contains(previous)) {
          previous.focus();
        }
      }
    };
  }, [open, initialFocusRef]);

  // ESC to close + Tab / Shift+Tab focus trap.
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusables = getFocusableDescendants(container);
      if (focusables.length === 0) {
        // No focusable children — keep focus on the container itself.
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const activeIsInside = active !== null && container.contains(active);

      if (event.shiftKey) {
        if (!activeIsInside || active === first || active === container) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!activeIsInside || active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Close only when the backdrop itself is the mousedown target (avoids
  // closing when a drag-select inside the card ends outside of it).
  function handleBackdropMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-2xl rounded-lg border border-border bg-card text-primary shadow-md outline-none",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

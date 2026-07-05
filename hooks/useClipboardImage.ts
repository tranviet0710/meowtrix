"use client";

import { useEffect, useRef } from "react";

/**
 * useClipboardImage — Listens for `paste` events on the window and forwards
 * the first `image/*` clipboard item to the caller as a `File`.
 *
 * The listener is only attached while `enabled` is true. Detaches on unmount
 * and when `enabled` transitions to false. Paste events that carry no image
 * payload are silently ignored.
 *
 * Used by the AI-assist upload zone so users can Ctrl+V / Cmd+V a screenshot
 * straight from the clipboard.
 *
 * _Requirements: 2.3_
 */
export function useClipboardImage(
  enabled: boolean,
  onImage: (file: File) => void
): void {
  // Keep the latest `onImage` in a ref so we don't have to re-attach the
  // listener every time the caller passes a new function identity.
  const onImageRef = useRef(onImage);

  useEffect(() => {
    onImageRef.current = onImage;
  }, [onImage]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items || items.length === 0) {
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            onImageRef.current(file);
          }
          // First image wins — stop scanning further items.
          return;
        }
      }
      // No image payload — silently ignore.
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [enabled]);
}

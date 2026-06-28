"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface SuccessToastState {
  visible: boolean;
  title: string;
  body: string;
}

const AUTO_DISMISS_MS = 5000;

/**
 * useSuccessToast — Simple hook for showing a transient success toast.
 * Auto-dismisses after 5 seconds.
 */
export function useSuccessToast() {
  const [toast, setToast] = useState<SuccessToastState>({
    visible: false,
    title: "",
    body: "",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: string, body: string) => {
    setToast({ visible: true, title, body });
  }, []);

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    if (toast.visible) {
      timerRef.current = setTimeout(dismissToast, AUTO_DISMISS_MS);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.visible, dismissToast]);

  return { toast, showToast, dismissToast };
}

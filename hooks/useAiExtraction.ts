"use client";

// hooks/useAiExtraction.ts — Client state machine for the AI-assist modal.
//
// Encapsulates the extraction lifecycle documented in
// `.kiro/specs/create-report-with-ai/design.md` (Client State Machine):
//
//   idle → uploaded → extracting → previewing → applying
//                          │            │
//                          └── error ◄──┘
//
// The hook owns:
//   • the currently selected `File`
//   • the last successful `ExtractionSuccess` payload
//   • a small `AiExtractionError` describing failure state + retryability
//
// The hook does NOT:
//   • upload the selected crops (that orchestration lives in `AiAssistModal`,
//     task 16 — the hook just transitions to `applying` when `apply()` fires)
//   • enforce the "≥ 1 non-null field" or "1..5 photos selected" rules — those
//     are the modal's responsibility.
//
// _Requirements: 4.6, 4.7, 4.8, 4.9, 11.2, 12.1, 12.2, 12.3, 12.4_

import { useCallback, useMemo, useRef, useState } from "react";

import type { ExtractionResponse, ExtractionSuccess } from "@/types/ai";

// --- Public types -----------------------------------------------------------

export type AiExtractionState =
  | "idle"
  | "uploaded"
  | "extracting"
  | "previewing"
  | "applying"
  | "error";

/**
 * User-facing error info emitted by the hook. `retryable` distinguishes the
 * transient failures (network hiccup, Gemini flake) from the hard stop of a
 * per-user quota exhaustion (Requirement 11.2: "no retry on quota exhaustion").
 */
export interface AiExtractionError {
  message: string;
  /** `false` only for `rate_limited`. Every other failure is retryable. */
  retryable: boolean;
}

export interface UseAiExtractionOptions {
  variant: "lost" | "spotted";
}

export interface UseAiExtractionActions {
  /**
   * Stage a screenshot for analysis. Passing `null` resets the machine to
   * `idle`. Passing a `File` moves to `uploaded` and clears any prior result
   * or error so the preview panel doesn't linger over a fresh upload.
   */
  setFile: (file: File | null) => void;

  /**
   * Send the staged file to `POST /api/ai/extract-report`. No-ops unless the
   * machine is currently in `uploaded` with a file. Transitions through
   * `extracting → previewing` on success or `extracting → error` on failure.
   */
  analyze: () => Promise<void>;

  /**
   * Caller signals the user activated "Apply to form". The hook only flips
   * to `applying` — the modal orchestrates the actual upload + form callback.
   */
  apply: () => void;

  /**
   * Full reset: forget the file, result, and error; return to `idle`.
   * Used when the modal closes.
   */
  reset: () => void;

  /**
   * Clear the current error and, if a file is still staged, return to
   * `uploaded` so the user can hit "Analyze screenshot" again. If the file
   * was cleared out from under us (e.g. after `reset`) we return to `idle`.
   */
  retry: () => void;
}

export interface UseAiExtractionResult {
  state: AiExtractionState;
  file: File | null;
  result: ExtractionSuccess | null;
  error: AiExtractionError | null;
  actions: UseAiExtractionActions;
}

// --- Copy strings (Requirement 12.4) ----------------------------------------

const NETWORK_ERROR_MESSAGE = "Network error. Try again in a moment.";
const GENERIC_ERROR_MESSAGE = "Something went wrong. Try again in a moment.";

// --- Hook -------------------------------------------------------------------

export function useAiExtraction(
  options: UseAiExtractionOptions
): UseAiExtractionResult {
  const { variant } = options;

  const [state, setState] = useState<AiExtractionState>("idle");
  const [file, setFileState] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractionSuccess | null>(null);
  const [error, setError] = useState<AiExtractionError | null>(null);

  // Mirror `state` and `file` in refs so the action callbacks can stay
  // referentially stable across renders (useCallback with `[]` / `[variant]`)
  // while still reading the current values. Consumers rely on stability so
  // effects/deps don't churn.
  const stateRef = useRef<AiExtractionState>("idle");
  const fileRef = useRef<File | null>(null);

  const transition = useCallback((next: AiExtractionState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const setFile = useCallback(
    (next: File | null) => {
      fileRef.current = next;
      setFileState(next);
      setResult(null);
      setError(null);
      transition(next === null ? "idle" : "uploaded");
    },
    [transition]
  );

  const analyze = useCallback(async () => {
    const currentFile = fileRef.current;
    // Preconditions: we must be in `uploaded` and have a file. Anything else
    // is a caller bug (e.g. double-click while extracting) — no-op silently.
    if (currentFile === null || stateRef.current !== "uploaded") {
      return;
    }

    setError(null);
    transition("extracting");

    const form = new FormData();
    form.append("file", currentFile);
    form.append("variant", variant);

    let response: Response;
    try {
      response = await fetch("/api/ai/extract-report", {
        method: "POST",
        body: form,
      });
    } catch {
      // Network error, DNS failure, offline, aborted, etc. Requirement 12.4.
      setError({ message: NETWORK_ERROR_MESSAGE, retryable: true });
      transition("error");
      return;
    }

    let body: ExtractionResponse;
    try {
      body = (await response.json()) as ExtractionResponse;
    } catch {
      // Body wasn't valid JSON — treat like a network error so the user can
      // simply try again.
      setError({ message: NETWORK_ERROR_MESSAGE, retryable: true });
      transition("error");
      return;
    }

    if (body.status === "ok") {
      setResult(body);
      transition("previewing");
      return;
    }

    // Error branch: only `rate_limited` is non-retryable (Requirement 11.2).
    // `extraction_error` and `invalid_input` are recoverable — the user can
    // fix the input (MIME/size) or retry against a fresh Gemini call.
    const message =
      typeof body.message === "string" && body.message.length > 0
        ? body.message
        : GENERIC_ERROR_MESSAGE;

    setError({
      message,
      retryable: body.status !== "rate_limited",
    });
    transition("error");
  }, [transition, variant]);

  const apply = useCallback(() => {
    // The modal is expected to gate this call; if it fires from any other
    // state we ignore it rather than corrupting the machine.
    if (stateRef.current !== "previewing") {
      return;
    }
    transition("applying");
  }, [transition]);

  const reset = useCallback(() => {
    fileRef.current = null;
    setFileState(null);
    setResult(null);
    setError(null);
    transition("idle");
  }, [transition]);

  const retry = useCallback(() => {
    setError(null);
    transition(fileRef.current !== null ? "uploaded" : "idle");
  }, [transition]);

  // Memoize the actions bag so consumers can safely depend on it in
  // `useEffect` / `useCallback` deps without triggering re-render loops. Each
  // inner action is already a stable `useCallback`, so this bag only churns
  // when `variant` changes (which recreates `analyze`).
  const actions = useMemo<UseAiExtractionActions>(
    () => ({ setFile, analyze, apply, reset, retry }),
    [setFile, analyze, apply, reset, retry]
  );

  return {
    state,
    file,
    result,
    error,
    actions,
  };
}

"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Shield,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { claimAnswersSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VerificationStatus = "idle" | "submitting" | "verified" | "rejected" | "locked";

interface ClaimVerificationFormProps {
  /** The claim ID to verify against */
  claimId: string;
  /** Number of failed attempts so far (for displaying lockout state) */
  failedAttempts?: number;
  /** ISO timestamp when lockout expires (if locked) */
  lockedUntil?: string | null;
  /** Callback fired after successful verification */
  onVerified?: () => void;
  /** Callback fired after rejection */
  onRejected?: (failedAttempts: number) => void;
}

interface FieldErrors {
  answer_name?: string;
  answer_marking?: string;
  answer_trait?: string;
}

const MAX_ATTEMPTS = 3;

/**
 * ClaimVerificationForm — Spy-themed verification form for proving cat ownership.
 *
 * Presents 3 security questions (cat name, physical marking, behavioral trait).
 * Posts answers to POST /api/claims/[id]/verify.
 * Displays verified/rejected result without revealing which answers were wrong.
 * Shows lockout state when 3 failures have been reached.
 *
 * Requirements: 9.1, 9.4, 9.5
 */
export function ClaimVerificationForm({
  claimId,
  failedAttempts = 0,
  lockedUntil = null,
  onVerified,
  onRejected,
}: ClaimVerificationFormProps) {
  // Form field state
  const [answerName, setAnswerName] = React.useState("");
  const [answerMarking, setAnswerMarking] = React.useState("");
  const [answerTrait, setAnswerTrait] = React.useState("");

  // UI state
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [status, setStatus] = React.useState<VerificationStatus>(() => {
    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      return "locked";
    }
    return "idle";
  });
  const [resultMessage, setResultMessage] = React.useState("");
  const [currentFailedAttempts, setCurrentFailedAttempts] = React.useState(failedAttempts);
  const [lockExpiry, setLockExpiry] = React.useState<string | null>(lockedUntil);

  // Check if lockout has expired (poll every second when locked)
  React.useEffect(() => {
    if (status !== "locked" || !lockExpiry) return;

    const interval = setInterval(() => {
      if (new Date(lockExpiry) <= new Date()) {
        setStatus("idle");
        setCurrentFailedAttempts(0);
        setResultMessage("");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, lockExpiry]);

  function validateForm(): boolean {
    const errors: FieldErrors = {};

    const result = claimAnswersSchema.safeParse({
      answer_name: answerName,
      answer_marking: answerMarking,
      answer_trait: answerTrait,
    });

    if (!result.success) {
      const flat = result.error.flatten();
      if (flat.fieldErrors.answer_name) {
        errors.answer_name = flat.fieldErrors.answer_name[0];
      }
      if (flat.fieldErrors.answer_marking) {
        errors.answer_marking = flat.fieldErrors.answer_marking[0];
      }
      if (flat.fieldErrors.answer_trait) {
        errors.answer_trait = flat.fieldErrors.answer_trait[0];
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResultMessage("");

    if (!validateForm()) return;

    setStatus("submitting");

    try {
      const response = await fetch(`/api/claims/${claimId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer_name: answerName.trim(),
          answer_marking: answerMarking.trim(),
          answer_trait: answerTrait.trim(),
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        // Locked out
        setStatus("locked");
        setLockExpiry(data.locked_until || null);
        setCurrentFailedAttempts(data.failed_attempts || MAX_ATTEMPTS);
        setResultMessage(
          data.message || "Too many failed attempts. Access locked for 24 hours."
        );
        return;
      }

      if (data.status === "verified") {
        setStatus("verified");
        setResultMessage(
          data.message || "Verification successful. The Agent reporter has been notified."
        );
        onVerified?.();
      } else if (data.status === "rejected") {
        setStatus("rejected");
        setCurrentFailedAttempts(data.failed_attempts || currentFailedAttempts + 1);
        setResultMessage(
          data.message || "Verification failed. Please review your answers and try again."
        );
        onRejected?.(data.failed_attempts || currentFailedAttempts + 1);
      } else if (data.status === "locked") {
        setStatus("locked");
        setLockExpiry(data.locked_until || null);
        setCurrentFailedAttempts(data.failed_attempts || MAX_ATTEMPTS);
        setResultMessage(
          data.message || "Too many failed attempts. Access locked for 24 hours."
        );
      } else if (!response.ok) {
        // Generic error from API
        setStatus("idle");
        setResultMessage(data.error || "Verification request failed. Try again.");
      }
    } catch {
      setStatus("idle");
      setResultMessage("Network error — check your connection and try again.");
    }
  }

  function handleRetry() {
    setStatus("idle");
    setResultMessage("");
    setAnswerName("");
    setAnswerMarking("");
    setAnswerTrait("");
    setFieldErrors({});
  }

  // Format remaining lockout time
  function formatLockoutRemaining(): string {
    if (!lockExpiry) return "";
    const remaining = new Date(lockExpiry).getTime() - Date.now();
    if (remaining <= 0) return "Lockout expired";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  // Locked out state
  if (status === "locked") {
    return (
      <div className="space-y-4 rounded-[2px] border border-danger/50 bg-danger/5 p-5">
        <div className="flex items-center gap-3">
          <Lock className="h-6 w-6 text-danger" aria-hidden="true" />
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-danger">
              ACCESS DENIED
            </h3>
            <p className="text-xs text-text-secondary">
              Security protocol lockout engaged
            </p>
          </div>
        </div>

        <div className="rounded-[2px] border border-danger/30 bg-card p-4" role="alert">
          <p className="text-sm text-text-primary">
            {resultMessage || "Too many failed verification attempts."}
          </p>
          {lockExpiry && (
            <p className="mt-2 font-mono text-xs text-danger">
              {formatLockoutRemaining()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <span>
            {MAX_ATTEMPTS}/{MAX_ATTEMPTS} attempts exhausted — lockout resets
            after 24 hours
          </span>
        </div>
      </div>
    );
  }

  // Verified success state
  if (status === "verified") {
    return (
      <div className="space-y-4 rounded-[2px] border border-success/50 bg-success/5 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-success">
              IDENTITY CONFIRMED
            </h3>
            <p className="text-xs text-text-secondary">
              Ownership verification protocol passed
            </p>
          </div>
        </div>

        <div className="rounded-[2px] border border-success/30 bg-card p-4" role="status">
          <p className="text-sm text-text-primary">
            {resultMessage || "Verification successful."}
          </p>
        </div>
      </div>
    );
  }

  // Form state (idle, submitting, or rejected with retry option)
  return (
    <div className="space-y-4 rounded-[2px] border border-accent/30 bg-card/50 p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-accent" aria-hidden="true" />
        <div>
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-accent">
            SECURITY VERIFICATION PROTOCOL
          </h3>
          <p className="text-xs text-text-secondary">
            Answer 3 questions to verify Overlord ownership
          </p>
        </div>
      </div>

      {/* Attempt counter */}
      {currentFailedAttempts > 0 && (
        <div className="flex items-center gap-2 rounded-[2px] border border-danger/30 bg-danger/5 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />
          <span className="font-mono text-xs text-danger">
            {currentFailedAttempts}/{MAX_ATTEMPTS} FAILED ATTEMPTS
          </span>
        </div>
      )}

      {/* Rejection banner */}
      {status === "rejected" && resultMessage && (
        <div
          className="flex items-start gap-2 rounded-[2px] border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{resultMessage}</span>
        </div>
      )}

      {/* Verification form */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Question 1: Cat Name */}
        <div className="space-y-2">
          <Label htmlFor="claim-answer-name">
            <span className="font-mono text-xs uppercase tracking-wider">
              Q1: Overlord Codename
            </span>{" "}
            <span className="text-danger">*</span>
          </Label>
          <p className="text-xs text-text-secondary">
            What is the cat&apos;s name?
          </p>
          <Input
            id="claim-answer-name"
            placeholder="Enter the Overlord's true name"
            value={answerName}
            onChange={(e) => {
              setAnswerName(e.target.value);
              if (fieldErrors.answer_name) {
                setFieldErrors((prev) => ({ ...prev, answer_name: undefined }));
              }
            }}
            maxLength={200}
            disabled={status === "submitting"}
            aria-invalid={!!fieldErrors.answer_name}
            aria-describedby={
              fieldErrors.answer_name ? "answer-name-error" : undefined
            }
            className={cn(fieldErrors.answer_name && "border-danger")}
          />
          <InlineError id="answer-name-error" message={fieldErrors.answer_name} />
          <p className="text-xs text-text-secondary">
            {answerName.length}/200 characters
          </p>
        </div>

        {/* Question 2: Physical Marking */}
        <div className="space-y-2">
          <Label htmlFor="claim-answer-marking">
            <span className="font-mono text-xs uppercase tracking-wider">
              Q2: Distinguishing Marking
            </span>{" "}
            <span className="text-danger">*</span>
          </Label>
          <p className="text-xs text-text-secondary">
            Describe a unique physical marking on the cat
          </p>
          <Input
            id="claim-answer-marking"
            placeholder="e.g., heart-shaped patch on left ear"
            value={answerMarking}
            onChange={(e) => {
              setAnswerMarking(e.target.value);
              if (fieldErrors.answer_marking) {
                setFieldErrors((prev) => ({
                  ...prev,
                  answer_marking: undefined,
                }));
              }
            }}
            maxLength={200}
            disabled={status === "submitting"}
            aria-invalid={!!fieldErrors.answer_marking}
            aria-describedby={
              fieldErrors.answer_marking ? "answer-marking-error" : undefined
            }
            className={cn(fieldErrors.answer_marking && "border-danger")}
          />
          <InlineError
            id="answer-marking-error"
            message={fieldErrors.answer_marking}
          />
          <p className="text-xs text-text-secondary">
            {answerMarking.length}/200 characters
          </p>
        </div>

        {/* Question 3: Behavioral Trait */}
        <div className="space-y-2">
          <Label htmlFor="claim-answer-trait">
            <span className="font-mono text-xs uppercase tracking-wider">
              Q3: Behavioral Signature
            </span>{" "}
            <span className="text-danger">*</span>
          </Label>
          <p className="text-xs text-text-secondary">
            Describe a unique behavioral trait of the cat
          </p>
          <Input
            id="claim-answer-trait"
            placeholder="e.g., chirps at birds, kneads blankets before napping"
            value={answerTrait}
            onChange={(e) => {
              setAnswerTrait(e.target.value);
              if (fieldErrors.answer_trait) {
                setFieldErrors((prev) => ({
                  ...prev,
                  answer_trait: undefined,
                }));
              }
            }}
            maxLength={200}
            disabled={status === "submitting"}
            aria-invalid={!!fieldErrors.answer_trait}
            aria-describedby={
              fieldErrors.answer_trait ? "answer-trait-error" : undefined
            }
            className={cn(fieldErrors.answer_trait && "border-danger")}
          />
          <InlineError
            id="answer-trait-error"
            message={fieldErrors.answer_trait}
          />
          <p className="text-xs text-text-secondary">
            {answerTrait.length}/200 characters
          </p>
        </div>

        {/* Submit / Retry */}
        <div className="flex gap-3">
          {status === "rejected" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRetry}
              className="flex-1"
            >
              Clear Answers
            </Button>
          )}
          <Button
            type="submit"
            className={cn("flex-1", status !== "rejected" && "w-full")}
            disabled={status === "submitting"}
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : status === "rejected" ? (
              "Retry Verification"
            ) : (
              "Submit Verification"
            )}
          </Button>
        </div>

        {/* Security notice */}
        <p className="text-center text-xs text-text-secondary">
          <Shield className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Answers are compared securely. Failed results do not reveal which
          answers were incorrect.
        </p>
      </form>
    </div>
  );
}

/** Inline validation error display */
function InlineError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <div
      id={id}
      className="flex items-start gap-1.5 text-xs text-danger"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

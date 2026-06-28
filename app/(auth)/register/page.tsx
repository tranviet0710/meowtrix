"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [resendError, setResendError] = useState("");

  async function handleResend() {
    if (!email) return;
    setResendState("sending");
    setResendError("");
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResendError(data.error || "Couldn't resend right now.");
        setResendState("idle");
        return;
      }
      setResendState("sent");
    } catch {
      setResendError("Network error.");
      setResendState("idle");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password.length > 128) {
      setError("Password must be 128 characters or fewer");
      return;
    }
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Show success state with email confirmation instructions
      setSuccess(true);
      setLoading(false);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  // Show success screen after registration
  if (success) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-text-primary">
            Registration Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <span className="text-3xl">📧</span>
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-text-primary font-medium">
              Check your email to activate your account
            </p>
            <p className="text-xs text-text-secondary">
              We sent a confirmation link to <span className="font-mono text-accent">{email}</span>.
              Click the link to verify your account before signing in.
            </p>
          </div>
          <div className="mt-2 w-full rounded-[2px] border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-text-secondary">
            <p className="mb-2">Didn&apos;t get the email? Check your spam folder or resend it below.</p>
            {resendState === "sent" ? (
              <p className="font-mono text-success">✓ Activation email resent.</p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={resendState === "sending"}
              >
                {resendState === "sending" ? "Sending..." : "Resend activation email"}
              </Button>
            )}
            {resendError && (
              <p className="mt-2 text-danger">{resendError}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-accent hover:underline">
            Go to Sign In
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="text-center">
        <CardTitle className="text-xl text-text-primary">
          Recruit New Informant
        </CardTitle>
        <CardDescription>
          Join the MEOWTRIX network and help track lost Overlords
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 rounded-[2px] border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              type="text"
              placeholder="Agent Whiskers"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="agent@meowtrix.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
            <p className="text-xs text-text-secondary">
              8–128 characters required
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-text-secondary">
          Already an informant?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

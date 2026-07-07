"use client";

import { useState } from "react";
import Link from "next/link";
import { MailWarning } from "lucide-react";
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

export default function ResendConfirmationPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setState("sending");
    setError("");

    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't resend the email. Try again in a moment.");
        setState("idle");
        return;
      }

      setState("sent");
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailWarning className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl text-text-primary">
          Resend Confirmation Email
        </CardTitle>
        <CardDescription>
          Enter your email to receive a new account activation link
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state === "sent" ? (
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-success/40 bg-success/10 p-4">
              <p className="text-sm text-success font-medium">
                ✓ Confirmation email sent!
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                If an unconfirmed account exists for <span className="font-medium">{email}</span>,
                a new activation link is on its way. It can take a minute to arrive.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setState("idle");
                setEmail("");
              }}
              className="w-full"
            >
              Send to another email
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
                <p className="text-xs text-text-secondary">
                  We&apos;ll send a new confirmation link if your account needs activation.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={state === "sending"}
              >
                {state === "sending" ? "Sending…" : "Send Confirmation Email"}
              </Button>
            </form>
          </>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-text-secondary">
          Already confirmed?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

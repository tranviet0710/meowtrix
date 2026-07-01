"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Clock,
  CheckCircle,
  Tag,
  Eye,
} from "lucide-react";

interface TraitTags {
  primary_color: string;
  secondary_color: string | null;
  pattern_type: string;
  fur_length: string;
  breed_estimate: string;
  distinguishing_features: string[];
}

interface AgentDetail {
  id: string;
  reporter_id: string;
  description: string;
  sighting_lat: number;
  sighting_lng: number;
  sighting_address: string | null;
  sighted_at: string;
  status: "active" | "resolved";
  photos: string[];
  trait_tags: TraitTags | null;
  tagging_status: string;
  is_seed: boolean;
  created_at: string;
}

interface PageState {
  agent: AgentDetail | null;
  isLoading: boolean;
  error: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Agent Detail Page — Shows full details of a spotted cat record.
 *
 * Displays:
 * - Photo gallery
 * - Description
 * - Sighting timestamp and location
 * - Trait tags (when available)
 * - Status badge (active/resolved)
 *
 * MEOWTRIX spy theme — styled as an "Agent Field Report."
 *
 * Requirements: 9.7
 */
export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [state, setState] = useState<PageState>({
    agent: null,
    isLoading: true,
    error: null,
  });

  const fetchAgent = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setState({
        agent: data.agent,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Request timed out. Check your connection.",
        }));
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
    }
  }, [agentId]);

  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId, fetchAgent]);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4 md:p-6">
        <div className="h-6 w-36 animate-pulse rounded-md bg-border" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-border" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        <p className="text-center text-xs text-text-secondary mt-4">
          Loading sighting…
        </p>
      </div>
    );
  }

  // Error state
  if (state.error && !state.agent) {
    return (
      <div className="flex h-full flex-col gap-4 p-4 md:p-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <div
          className="flex flex-col items-center gap-3 rounded-[2px] border border-danger/50 bg-card p-6"
          role="alert"
        >
          <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
          <p className="text-sm text-text-primary">{state.error}</p>
          <button
            onClick={fetchAgent}
            className="min-h-[44px] rounded-[2px] border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!state.agent) return null;

  const { agent } = state;

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      {/* Header: Title + Status */}
      <header className="flex flex-col gap-3 rounded-xl border border-success/30 bg-card p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-success" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Pet Sighting
            </h1>
            <p className="text-xs text-text-secondary">
              A pet was spotted nearby
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${
            agent.status === "active"
              ? "bg-success/10 text-success"
              : "bg-muted text-text-secondary"
          }`}
        >
          {agent.status === "active" ? "Active" : "Resolved"}
        </span>
      </header>

      {/* Photo Gallery */}
      {agent.photos.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Photos
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {agent.photos.map((photo, idx) => (
              <div
                key={idx}
                className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-[2px] border border-border bg-background sm:h-40 sm:w-40"
              >
                <img
                  src={photo}
                  alt={`Agent sighting photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Location */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-xs font-semibold text-text-secondary">
              Sighting location
            </span>
          </div>
          {agent.sighting_address ? (
            <>
              <p className="text-sm text-text-primary leading-snug">
                {agent.sighting_address}
              </p>
              <p className="font-mono text-[11px] text-text-secondary mt-1">
                {agent.sighting_lat.toFixed(5)}, {agent.sighting_lng.toFixed(5)}
              </p>
            </>
          ) : (
            <p className="font-mono text-sm text-text-primary">
              {agent.sighting_lat.toFixed(5)}, {agent.sighting_lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold text-text-secondary">
              Sighted at
            </span>
          </div>
          <p className="text-sm text-text-primary">
            {new Date(agent.sighted_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">
            Notes
          </h2>
          <p className="text-sm text-text-primary leading-relaxed">
            {agent.description}
          </p>
        </section>
      )}

      {/* Trait Tags */}
      {agent.trait_tags && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-text-primary">
              Pet Details (AI-detected)
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Primary Color</span>
              <span className="font-mono text-text-primary capitalize">
                {agent.trait_tags.primary_color}
              </span>
            </div>
            {agent.trait_tags.secondary_color && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Secondary Color</span>
                <span className="font-mono text-text-primary capitalize">
                  {agent.trait_tags.secondary_color}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Pattern</span>
              <span className="font-mono text-text-primary capitalize">
                {agent.trait_tags.pattern_type}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Fur Length</span>
              <span className="font-mono text-text-primary capitalize">
                {agent.trait_tags.fur_length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Breed</span>
              <span className="font-mono text-text-primary capitalize">
                {agent.trait_tags.breed_estimate}
              </span>
            </div>
          </div>

          {/* Distinguishing Features */}
          {agent.trait_tags.distinguishing_features.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <span className="text-xs font-semibold text-text-secondary">
                Distinguishing Features
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {agent.trait_tags.distinguishing_features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Resolved banner */}
      {agent.status === "resolved" && (
        <section className="rounded-xl border border-success/40 bg-success/10 p-4 text-center shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" aria-hidden="true" />
            <p className="text-sm font-semibold text-success">
              🎉 Matched — this sighting helped reunite a pet
            </p>
          </div>
        </section>
      )}

      {/* Metadata footer */}
      <div className="text-center">
        <p className="text-[10px] text-text-secondary/60">
          ID: {agent.id.slice(0, 8)} · Posted{" "}
          {new Date(agent.created_at).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </p>
      </div>
    </div>
  );
}

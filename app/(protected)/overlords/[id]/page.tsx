"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Clock,
  Download,
  CheckCircle,
  Tag,
  ExternalLink,
  FileText,
} from "lucide-react";

interface TraitTags {
  primary_color: string;
  secondary_color: string | null;
  pattern_type: string;
  fur_length: string;
  breed_estimate: string;
  distinguishing_features: string[];
}

interface OverlordDetail {
  id: string;
  owner_id: string;
  pet_name: string;
  pet_type: "cat" | "dog";
  description: string;
  last_seen_lat: number;
  last_seen_lng: number;
  last_seen_address: string | null;
  last_seen_at: string;
  status: "active" | "resolved";
  photos: string[];
  trait_tags: TraitTags | null;
  tagging_status: string;
  poster_url: string | null;
  is_seed: boolean;
  created_at: string;
}

interface PageState {
  overlord: OverlordDetail | null;
  isLoading: boolean;
  error: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Overlord Detail Page — Shows full details of a lost cat record.
 *
 * Displays:
 * - Photo gallery
 * - Cat name and description
 * - Last-seen timestamp and location
 * - Trait tags (when available)
 * - Status badge (active/resolved)
 * - Poster download link (Requirement 7.7: when poster_url is available)
 *
 * MEOWTRIX spy theme — styled as an "Overlord Intelligence Report."
 *
 * Requirements: 7.7, 9.7
 */
export default function OverlordDetailPage() {
  const params = useParams();
  const overlordId = params.id as string;

  const [state, setState] = useState<PageState>({
    overlord: null,
    isLoading: true,
    error: null,
  });

  const fetchOverlord = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/overlords/${overlordId}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setState({
        overlord: data.overlord,
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
  }, [overlordId]);

  useEffect(() => {
    if (overlordId) {
      fetchOverlord();
    }
  }, [overlordId, fetchOverlord]);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4 md:p-6">
        <div className="h-6 w-36 animate-pulse rounded-md bg-border" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-border" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        <p className="text-center text-xs text-text-secondary mt-4">
          Loading pet details…
        </p>
      </div>
    );
  }

  // Error state
  if (state.error && !state.overlord) {
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
            onClick={fetchOverlord}
            className="min-h-[44px] rounded-[2px] border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!state.overlord) return null;

  const { overlord } = state;

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

      {/* Header: Name + Status */}
      <header className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-card p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-danger animate-pulse" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {overlord.pet_name}
            </h1>
            <p className="text-xs text-text-secondary">
              Missing pet report
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${
            overlord.status === "active"
              ? "bg-danger/10 text-danger"
              : "bg-success/10 text-success"
          }`}
        >
          {overlord.status === "active" ? "Missing" : "Home 🎉"}
        </span>
      </header>

      {/* Photo Gallery */}
      {overlord.photos.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Photos
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {overlord.photos.map((photo, idx) => (
              <div
                key={idx}
                className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-[2px] border border-border bg-background sm:h-40 sm:w-40"
              >
                <img
                  src={photo}
                  alt={`${overlord.pet_name} photo ${idx + 1}`}
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
            <MapPin className="h-4 w-4 text-danger" aria-hidden="true" />
            <span className="text-xs font-semibold text-text-secondary">
              Last seen at
            </span>
          </div>
          {overlord.last_seen_address ? (
            <>
              <p className="text-sm text-text-primary leading-snug">
                {overlord.last_seen_address}
              </p>
              <p className="font-mono text-[11px] text-text-secondary mt-1">
                {overlord.last_seen_lat.toFixed(5)}, {overlord.last_seen_lng.toFixed(5)}
              </p>
            </>
          ) : (
            <p className="font-mono text-sm text-text-primary">
              {overlord.last_seen_lat.toFixed(5)}, {overlord.last_seen_lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold text-text-secondary">
              When
            </span>
          </div>
          <p className="text-sm text-text-primary">
            {new Date(overlord.last_seen_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {/* Description */}
      {overlord.description && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">
            Notes
          </h2>
          <p className="text-sm text-text-primary leading-relaxed">
            {overlord.description}
          </p>
        </section>
      )}

      {/* Trait Tags */}
      {overlord.trait_tags && (
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
                {overlord.trait_tags.primary_color}
              </span>
            </div>
            {overlord.trait_tags.secondary_color && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Secondary Color</span>
                <span className="font-mono text-text-primary capitalize">
                  {overlord.trait_tags.secondary_color}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Pattern</span>
              <span className="font-mono text-text-primary capitalize">
                {overlord.trait_tags.pattern_type}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Fur Length</span>
              <span className="font-mono text-text-primary capitalize">
                {overlord.trait_tags.fur_length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Breed</span>
              <span className="font-mono text-text-primary capitalize">
                {overlord.trait_tags.breed_estimate}
              </span>
            </div>
          </div>

          {/* Distinguishing Features */}
          {overlord.trait_tags.distinguishing_features.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <span className="text-xs font-semibold text-text-secondary">
                Distinguishing Features
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {overlord.trait_tags.distinguishing_features.map((feature, idx) => (
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

      {/* Poster: inline preview + download */}
      {overlord.poster_url && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-[var(--shadow-soft)] sm:p-5">
          {/* Header: title + actions */}
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold text-text-primary">
                  Missing pet poster
                </p>
                <p className="text-xs text-text-secondary">
                  A4 printable PDF — preview below, or download to print
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <a
                href={overlord.poster_url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-card px-4 py-2 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/10 sm:flex-none"
                aria-label={`Open poster for ${overlord.pet_name} in a new tab`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open in new tab
              </a>
              <a
                href={overlord.poster_url}
                download={`missing-${overlord.pet_name.replace(/\s+/g, "-").toLowerCase()}.pdf`}
                className="min-h-[44px] inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-primary)] transition-all hover:-translate-y-0.5 hover:brightness-105 sm:flex-none"
                aria-label={`Download poster for ${overlord.pet_name}`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </a>
            </div>
          </div>

          {/* Inline PDF preview */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
            <object
              data={overlord.poster_url}
              type="application/pdf"
              className="block h-[560px] w-full sm:h-[720px]"
              aria-label={`PDF preview of the missing-pet poster for ${overlord.pet_name}`}
            >
              {/* Fallback for browsers that can't render PDFs inline (e.g. some mobile browsers) */}
              <div className="flex h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText
                  className="h-10 w-10 text-text-secondary"
                  aria-hidden="true"
                />
                <p className="text-sm text-text-primary">
                  Your browser can&apos;t show the PDF here.
                </p>
                <a
                  href={overlord.poster_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-primary)] transition-all hover:-translate-y-0.5 hover:brightness-105"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open poster in a new tab
                </a>
              </div>
            </object>
          </div>
        </section>
      )}

      {/* Resolved banner */}
      {overlord.status === "resolved" && (
        <section className="rounded-xl border border-success/40 bg-success/10 p-4 text-center shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" aria-hidden="true" />
            <p className="text-sm font-semibold text-success">
              🎉 Reunited — {overlord.pet_name} is home
            </p>
          </div>
        </section>
      )}

      {/* Metadata footer */}
      <div className="text-center">
        <p className="text-[10px] text-text-secondary/60">
          ID: {overlord.id.slice(0, 8)} · Posted{" "}
          {new Date(overlord.created_at).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </p>
      </div>
    </div>
  );
}

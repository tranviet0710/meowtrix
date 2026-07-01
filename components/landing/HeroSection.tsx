/* eslint-disable @next/next/no-img-element */
// Mascot gif is a lightweight Giphy embed; using <img> avoids configuring
// next/image remote patterns just for a decorative thumbnail.
import Link from "next/link";
import { ArrowRight, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreeBackground } from "./ThreeBackground";

interface HeroSectionProps {
  isAuthenticated: boolean;
}

export function HeroSection({ isAuthenticated }: HeroSectionProps) {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden pt-16">
      {/* Three.js animated backdrop */}
      <ThreeBackground />

      {/* Soft dot pattern overlay — warmer than a hard scan-grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          color: "var(--color-primary)",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Vignette — uses background token so it adapts across themes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, color-mix(in oklab, var(--color-background) 90%, transparent) 85%)",
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/70 px-4 py-1.5 text-[11px] font-semibold text-primary backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Reuniting pets with families 🐾
        </div>

        {/* Headline */}
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-5xl font-black leading-[0.98] tracking-tight text-text-primary sm:text-7xl md:text-[7rem]">
          <span className="text-primary">Meow</span>trix
        </h1>

        <p className="mt-4 max-w-2xl font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-text-secondary sm:text-2xl">
          The kind way to find lost cats &amp; dogs
        </p>

        {/* Friendly mascot card */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-border bg-card/80 py-2 pl-2 pr-4 shadow-[var(--shadow-soft)] backdrop-blur-sm">
          <img
            src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif"
            alt="Friendly Meowtrix mascot"
            loading="eager"
            className="meowtrix-wiggle h-10 w-10 rounded-xl object-cover sm:h-12 sm:w-12"
          />
          <div className="text-left">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Live · Community
            </div>
            <div className="text-xs font-semibold text-text-primary sm:text-sm">
              &ldquo;Everyone helps. Every pet matters.&rdquo;
            </div>
          </div>
        </div>

        {/* Mission lede */}
        <p className="mt-8 max-w-2xl text-balance text-base leading-relaxed text-text-primary/85 sm:text-lg">
          A warm, community-powered app for reuniting lost cats and dogs
          with their families. We use{" "}
          <span className="font-semibold text-primary">AI photo matching</span>,
          a{" "}
          <span className="font-semibold text-primary">live sightings map</span>,
          and{" "}
          <span className="font-semibold text-primary">smart alerts to nearby helpers</span>
          {" "}— so no pet has to stay lost.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {isAuthenticated ? (
            <>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/dashboard">
                  Open Meowtrix
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/report-lost">Report a Missing Pet</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">
                  Get Started — Free
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/login">I already have an account</Link>
              </Button>
            </>
          )}
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-text-secondary">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            Free for families
          </span>
          <span className="hidden text-border sm:inline">•</span>
          <span className="inline-flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Real-time alerts
          </span>
          <span className="hidden text-border sm:inline">•</span>
          <span>No ads · No data resale</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[10px] font-medium text-text-secondary opacity-70">
        ↓ Learn more
      </div>
    </section>
  );
}

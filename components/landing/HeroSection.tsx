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

      {/* Scan-grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #FFCC00 1px, transparent 1px), linear-gradient(to bottom, #FFCC00 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(10,10,15,0.85)_85%)]"
      />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <div className="mb-6 inline-flex items-center gap-2 border border-accent/40 bg-card/60 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          MEOWTRIX // HQ ONLINE — REUNITING PETS WITH FAMILIES
        </div>

        {/* Hashtag headline */}
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-5xl font-black uppercase leading-[0.92] tracking-tight text-text-primary sm:text-7xl md:text-[8rem]">
          <span className="text-accent">#</span>MEOWTRIX
        </h1>

        <p className="mt-4 max-w-2xl font-[family-name:var(--font-space-grotesk)] text-lg font-bold uppercase tracking-wider text-text-secondary sm:text-xl">
          The World&apos;s First Feline &amp; Canine Overlord Tracker
        </p>

        {/* Friendly mascot — adds a little warmth to the spy aesthetic */}
        <div className="mt-8 inline-flex items-center gap-3 border border-accent/30 bg-card/70 py-2 pl-2 pr-4 backdrop-blur-sm">
          <img
            src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif"
            alt="Cat agent watching over HQ"
            loading="eager"
            className="h-10 w-10 border border-accent/40 object-cover sm:h-12 sm:w-12"
          />
          <div className="text-left">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
              Field Comms · Live
            </div>
            <div className="text-xs font-semibold text-text-primary sm:text-sm">
              &ldquo;We&apos;ve got eyes on every block. Stay pawsitive.&rdquo;
            </div>
          </div>
        </div>

        {/* Mission lede */}
        <p className="mt-8 max-w-2xl text-balance text-base leading-relaxed text-text-primary/85 sm:text-lg">
          A humanitarian command center for reuniting lost cats and dogs with their families.
          We combine{" "}
          <span className="font-semibold text-accent">AI vision</span>,
          live{" "}
          <span className="font-semibold text-accent">community sighting maps</span>,
          and an{" "}
          <span className="font-semibold text-accent">escalating search protocol</span>
          {" "}— so no pet has to stay lost.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {isAuthenticated ? (
            <>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/dashboard">
                  Go to HQ
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
                  Deploy a Report
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/login">I&apos;m already an Informant</Link>
              </Button>
            </>
          )}
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-widest text-text-secondary">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            Free for families
          </span>
          <span className="hidden text-border sm:inline">•</span>
          <span className="inline-flex items-center gap-2">
            <Radio className="h-4 w-4 text-accent" />
            Real-time alerts
          </span>
          <span className="hidden text-border sm:inline">•</span>
          <span className="font-mono">No ads · No data resale</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-60">
        ↓ Briefing below
      </div>
    </section>
  );
}

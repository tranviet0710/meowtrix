/* eslint-disable @next/next/no-img-element */
// Reunion gif is a lightweight Giphy embed; using <img> avoids configuring
// next/image remote patterns just for a decorative thumbnail.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CtaSectionProps {
  isAuthenticated: boolean;
}

export function CtaSection({ isAuthenticated }: CtaSectionProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-card">
      {/* Diagonal stripe pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #FFCC00 0 2px, transparent 2px 24px)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="border-[3px] border-accent bg-background p-8 shadow-[8px_8px_0_0_rgba(255,204,0,0.6)] sm:p-12 lg:p-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">
                {"// Transmission Begins"}
              </div>
              <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black uppercase leading-[1.02] text-text-primary sm:text-5xl lg:text-6xl">
                Your pet is out there.{" "}
                <span className="text-accent">Let&apos;s bring them home.</span>
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
                Whether you&apos;ve lost a cat, found a wandering dog, or just want
                to be a neighborhood informant — start here. Free, forever.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                {isAuthenticated ? (
                  <>
                    <Button asChild size="lg">
                      <Link href="/dashboard">
                        Go to HQ
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="/report-lost">Report a Missing Pet</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg">
                      <Link href="/register">
                        Create your free account
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="/login">Sign In</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Happy reunion mascot */}
            <div className="relative mx-auto hidden w-full max-w-[220px] lg:block">
              <div className="relative border border-accent/50 bg-card p-2 shadow-[0_0_28px_0_rgba(255,204,0,0.18)]">
                <img
                  src="https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif"
                  alt="Happy cat celebrating a reunion"
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <div className="mt-2 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
                  Status · Reunited
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

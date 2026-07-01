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
      {/* Soft dot pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          color: "var(--color-primary)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="rounded-2xl border border-border bg-background p-8 shadow-[var(--shadow-lg)] sm:p-12 lg:p-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="text-xs font-semibold text-primary">
                Ready when you are 🐾
              </div>
              <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black leading-[1.05] tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
                Your pet is out there.{" "}
                <span className="text-primary">Let&apos;s bring them home.</span>
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
                Whether you&apos;ve lost a cat, spotted a wandering dog, or just
                want to be a helpful neighbor — start here. Free, forever.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                {isAuthenticated ? (
                  <>
                    <Button asChild size="lg">
                      <Link href="/dashboard">
                        Open Meowtrix
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
              <div className="relative rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-md)]">
                <img
                  src="https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif"
                  alt="Happy cat celebrating a reunion"
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <div className="mt-2 text-center text-[11px] font-semibold text-primary">
                  Reunited 🎉
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

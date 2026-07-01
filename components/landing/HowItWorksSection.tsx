import Link from "next/link";
import { ArrowRight, Camera, ScanSearch, Radio, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "01",
    icon: Camera,
    title: "Post the report",
    body: "Upload a photo and tap the last-seen spot on the map. Takes about 60 seconds.",
  },
  {
    n: "02",
    icon: ScanSearch,
    title: "AI tags the details",
    body: "Our AI pulls breed, coat color, markings, and distinguishing features from the photo.",
  },
  {
    n: "03",
    icon: Radio,
    title: "Neighbors get alerted",
    body: "Helpers nearby are notified. The radius widens automatically if there's no match in 6 hours.",
  },
  {
    n: "04",
    icon: PawPrint,
    title: "Reunite, verified",
    body: "When a sighting matches, both sides verify with photo proof — then your pet comes home.",
  },
];

interface HowItWorksSectionProps {
  isAuthenticated: boolean;
}

export function HowItWorksSection({ isAuthenticated }: HowItWorksSectionProps) {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 border-b border-border bg-card/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mb-12 max-w-3xl">
          <div className="text-xs font-semibold text-primary">How it works</div>
          <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black leading-tight tracking-tight text-text-primary sm:text-5xl">
            Four steps from{" "}
            <span className="text-primary">missing to home.</span>
          </h2>
        </div>

        {/* Timeline grid */}
        <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ n, icon: Icon, title, body }, idx) => (
            <li
              key={n}
              className="relative rounded-xl border border-border bg-background p-6 shadow-[var(--shadow-soft)] sm:p-7"
            >
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold text-primary sm:text-4xl">
                  {n}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              {/* Connector arrow on large screens */}
              {idx < STEPS.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary lg:block"
                />
              )}

              <h3 className="mt-5 text-base font-semibold text-text-primary sm:text-lg">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button asChild size="lg">
            <Link href={isAuthenticated ? "/report-lost" : "/register"}>
              {isAuthenticated ? "Post a Report Now" : "Start Your Report"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-xs text-text-secondary">
            60-second setup · no credit card · no spam
          </p>
        </div>
      </div>
    </section>
  );
}

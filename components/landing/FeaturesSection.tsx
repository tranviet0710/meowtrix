import {
  Brain,
  MapPinned,
  Bell,
  ShieldCheck,
  Trophy,
  Workflow,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Photo Matching",
    body: "One photo. Our AI extracts breed, coat color, markings, and unique features so matches keep working even when descriptions don't.",
    tag: "Gemini AI",
  },
  {
    icon: MapPinned,
    title: "Live Sightings Map",
    body: "See high-probability zones based on roaming distance, time elapsed, and helper sightings nearby.",
    tag: "Leaflet · OSM",
  },
  {
    icon: Workflow,
    title: "Smart Search Timeline",
    body: "Alerts widen automatically at 6h, 24h, and 48h — the right people get notified at the right moment.",
    tag: "Automated",
  },
  {
    icon: Bell,
    title: "Real-time Match Alerts",
    body: "The moment a sighting matches your missing pet, you get a notification. No refreshing required.",
    tag: "Realtime",
  },
  {
    icon: ShieldCheck,
    title: "Verified Reunions",
    body: "Owner-only verification questions and photo proof keep bad actors out and your pet's recovery safe.",
    tag: "Secure claims",
  },
  {
    icon: Trophy,
    title: "Helper Leaderboard",
    body: "Earn points for valid sightings and confirmed reunions. The community that helps gets recognized.",
    tag: "Community",
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative scroll-mt-20 border-b border-border bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mb-12 max-w-3xl">
          <div className="text-xs font-semibold text-primary">
            What&apos;s inside
          </div>
          <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black leading-tight tracking-tight text-text-primary sm:text-5xl">
            Built like search-and-rescue.{" "}
            <span className="text-primary">Designed for humans.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-text-secondary sm:text-lg">
            Every tool a search effort needs — wrapped in an interface anyone
            can use the moment their pet goes missing.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, tag }) => (
            <li
              key={title}
              className="group relative rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-md)] sm:p-7"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>

              <h3 className="mt-5 text-lg font-semibold text-text-primary">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {body}
              </p>

              <div className="mt-5 inline-block rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-medium text-text-secondary">
                {tag}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

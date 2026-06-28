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
    title: "AI Vision Tagging",
    body: "Gemini auto-extracts breed, coat color, markings, eye color, and unique traits from a single photo. Matching keeps working even when descriptions don't.",
    tag: "Gemini API",
  },
  {
    icon: MapPinned,
    title: "Live Sighting Heatmap",
    body: "Leaflet-powered map shows high-probability zones based on roaming distance, time elapsed, and informant sightings nearby.",
    tag: "Leaflet · OSM",
  },
  {
    icon: Workflow,
    title: "Escalating Search Protocol",
    body: "A Temporal workflow widens the alert radius automatically at 6h, 24h, and 48h — the right people get pinged at the right time.",
    tag: "Temporal",
  },
  {
    icon: Bell,
    title: "Real-time Match Alerts",
    body: "The moment a found-pet report matches your missing one, we send an incoming transmission. No refreshing required.",
    tag: "Realtime",
  },
  {
    icon: ShieldCheck,
    title: "Verified Reunions",
    body: "Owner-only verification questions and photo proof keep bad actors out and your pet's recovery secure.",
    tag: "Secure claims",
  },
  {
    icon: Trophy,
    title: "Informant Leaderboard",
    body: "Earn points for valid sightings and confirmed reunions. The community that helps gets recognized.",
    tag: "Gamified",
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
          <div className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">
            {"// Capabilities"}
          </div>
          <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black uppercase leading-[1.05] text-text-primary sm:text-5xl">
            Built like a command center.{" "}
            <span className="text-accent">Designed for humans.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-text-secondary sm:text-lg">
            Every tool a search-and-rescue effort needs — wrapped in an
            interface anyone can use the moment their pet goes missing.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, tag }) => (
            <li
              key={title}
              className="group relative bg-card p-6 transition-colors hover:bg-card/70 sm:p-7"
            >
              {/* corner crosshair */}
              <span
                aria-hidden="true"
                className="absolute right-3 top-3 font-mono text-[10px] text-accent/40 transition-colors group-hover:text-accent"
              >
                +
              </span>

              <div className="flex h-12 w-12 items-center justify-center border border-accent/40 bg-background text-accent transition-all group-hover:border-accent group-hover:shadow-[0_0_24px_0_rgba(255,204,0,0.25)]">
                <Icon className="h-5 w-5" />
              </div>

              <h3 className="mt-5 text-lg font-bold uppercase tracking-wide text-text-primary">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {body}
              </p>

              <div className="mt-5 inline-block border border-border bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                {tag}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

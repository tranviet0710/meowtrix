import { Heart, Sparkles, Users } from "lucide-react";

const MISSION_POINTS = [
  {
    icon: Heart,
    title: "Kind, not transactional",
    body: "No paywalls. No premium tiers. No selling your data. Meowtrix exists so a missing pet gets home — full stop.",
  },
  {
    icon: Sparkles,
    title: "AI that levels the playing field",
    body: "Our AI tags every photo with breed, color, markings, and features. Even families without the perfect snapshot get matched.",
  },
  {
    icon: Users,
    title: "Powered by neighbors",
    body: "Every sighting from every helper feeds the map. The network is your community — Meowtrix just gives it eyes and ears.",
  },
];

export function MissionSection() {
  return (
    <section
      id="mission"
      className="relative scroll-mt-20 border-b border-border bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left: heading */}
          <div className="lg:col-span-5">
            <div className="text-xs font-semibold text-primary">The mission</div>
            <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black leading-tight tracking-tight text-text-primary sm:text-5xl">
              Every pet is{" "}
              <span className="text-primary">someone&apos;s family.</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-text-primary/80 sm:text-lg">
              Roughly <span className="font-semibold text-primary">1 in 3</span> pets
              goes missing in their lifetime. Most are found within a mile of
              home — when the right neighbor sees the right photo at the right
              time. Meowtrix makes that moment happen on purpose, not by luck.
            </p>
          </div>

          {/* Right: mission cards */}
          <div className="lg:col-span-7">
            <ul className="grid gap-4 sm:gap-5">
              {MISSION_POINTS.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="group relative rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-md)] sm:p-6"
                >
                  <div className="flex gap-4 sm:gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-text-primary sm:text-lg">
                        {title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary sm:text-[15px]">
                        {body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

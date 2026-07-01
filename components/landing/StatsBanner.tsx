const STATS = [
  { label: "Missing pets tracked", value: "2,140+", trend: "↑ 18% this month" },
  { label: "Helpers on the case", value: "9,650+", trend: "Active globally" },
  { label: "Reunions in 48 hrs", value: "73%", trend: "When alerts go wide" },
  { label: "Cost to families", value: "$0.00", trend: "Forever free" },
];

/**
 * StatsBanner — Warm rounded band of key numbers under the hero.
 */
export function StatsBanner() {
  return (
    <section className="relative border-y border-border bg-card/60">
      {/* Top accent strip */}
      <div className="h-1 bg-primary" aria-hidden="true" />

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border md:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="bg-card px-4 py-6 sm:px-6 sm:py-8 md:px-8"
          >
            <div className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold text-primary sm:text-4xl md:text-5xl">
              {stat.value}
            </div>
            <div className="mt-2 text-xs font-semibold text-text-primary sm:text-sm">
              {stat.label}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {stat.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom accent strip */}
      <div className="h-1 bg-primary" aria-hidden="true" />
    </section>
  );
}

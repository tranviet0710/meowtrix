const STATS = [
  { label: "Lost Overlords logged", value: "2,140+", trend: "↑ 18% this month" },
  { label: "Agents on the case", value: "9,650+", trend: "Active globally" },
  { label: "Reunions in 48 hrs", value: "73%", trend: "When alerts go wide" },
  { label: "Cost to families", value: "$0.00", trend: "Forever free" },
];

export function StatsBanner() {
  return (
    <section className="relative border-y border-border bg-card/60">
      {/* Top accent strip */}
      <div className="h-1 bg-accent" aria-hidden="true" />

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border md:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="bg-card px-4 py-6 sm:px-6 sm:py-8 md:px-8"
          >
            <div className="font-[family-name:var(--font-jetbrains-mono)] text-3xl font-bold text-accent sm:text-4xl md:text-5xl">
              {stat.value}
            </div>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-text-primary sm:text-xs">
              {stat.label}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary sm:text-[11px]">
              {stat.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom accent strip */}
      <div className="h-1 bg-accent" aria-hidden="true" />
    </section>
  );
}

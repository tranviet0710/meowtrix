/* eslint-disable @next/next/no-img-element */
// Gifs are remote, lightweight Giphy embeds. Using <img> keeps it simple and
// avoids configuring remotePatterns in next.config.ts.

const AGENTS = [
  {
    codename: "AGT-001 // BISCUIT",
    role: "Senior Surveillance Officer",
    quote: "Spotted suspicious tuna activity in sector 7.",
    src: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
    alt: "Cat staring intensely at a screen",
    accent: "accent" as const,
  },
  {
    codename: "AGT-007 // MOCHI",
    role: "Field Operative",
    quote: "Box secured. Mission accomplished.",
    src: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif",
    alt: "Cat peeking from behind a corner",
    accent: "success" as const,
  },
  {
    codename: "AGT-K9 // CHORIZO",
    role: "Recon & Recovery",
    quote: "Tail wagging detected. Threat level: friendly.",
    src: "https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif",
    alt: "Cat looking around suspiciously",
    accent: "accent" as const,
  },
  {
    codename: "AGT-042 // NOODLE",
    role: "Intelligence Analyst",
    quote: "Cross-referencing whisker patterns now.",
    src: "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
    alt: "Cat investigating a curious object",
    accent: "success" as const,
  },
];

export function MascotsGallery() {
  return (
    <section
      id="agents"
      className="relative scroll-mt-20 border-b border-border bg-card/40"
    >
      {/* Faint scanline pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #FFCC00 0 1px, transparent 1px 6px)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        {/* Heading */}
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">
              {"// Field Dossier"}
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black uppercase leading-[1.05] text-text-primary sm:text-5xl">
              Meet the agents{" "}
              <span className="text-accent">on duty.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-text-secondary sm:text-lg">
              Every reunion starts with a fuzzy face. Here are a few of the
              furry operatives our informants have brought home.
            </p>
          </div>

          {/* Live indicator */}
          <div className="inline-flex items-center gap-2 self-start border border-success/40 bg-background px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-success sm:self-end">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live · 4 agents online
          </div>
        </div>

        {/* Gallery grid */}
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((agent) => {
            const ring =
              agent.accent === "success"
                ? "hover:shadow-[0_0_28px_0_rgba(0,255,136,0.25)] hover:border-success/70"
                : "hover:shadow-[0_0_28px_0_rgba(255,204,0,0.25)] hover:border-accent/70";
            const dot =
              agent.accent === "success" ? "bg-success" : "bg-accent";
            return (
              <li
                key={agent.codename}
                className={`group relative overflow-hidden border border-border bg-background transition-all ${ring}`}
              >
                {/* Corner brackets for that surveillance feel */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2 top-2 z-10 h-3 w-3 border-l-2 border-t-2 border-accent/60 transition-colors group-hover:border-accent"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-2 z-10 h-3 w-3 border-r-2 border-t-2 border-accent/60 transition-colors group-hover:border-accent"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-2 left-2 z-10 h-3 w-3 border-b-2 border-l-2 border-accent/60 transition-colors group-hover:border-accent"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-2 right-2 z-10 h-3 w-3 border-b-2 border-r-2 border-accent/60 transition-colors group-hover:border-accent"
                />

                {/* Gif */}
                <div className="relative aspect-square overflow-hidden bg-black">
                  <img
                    src={agent.src}
                    alt={agent.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Tinted overlay so the dark theme stays cohesive */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(10,10,15,0.55)_100%)]"
                  />
                  {/* Rec indicator */}
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-text-primary backdrop-blur-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
                    REC
                  </div>
                </div>

                {/* Meta */}
                <div className="border-t border-border p-4">
                  <div className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-bold uppercase tracking-widest text-accent">
                    {agent.codename}
                  </div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-text-primary">
                    {agent.role}
                  </div>
                  <p className="mt-2 text-sm italic leading-snug text-text-secondary">
                    &ldquo;{agent.quote}&rdquo;
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Friendly footnote */}
        <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          No animals were inconvenienced in the making of this dossier ·
          Treats may have been distributed
        </p>
      </div>
    </section>
  );
}

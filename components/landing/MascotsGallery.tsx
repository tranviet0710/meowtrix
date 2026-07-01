/* eslint-disable @next/next/no-img-element */
// Gifs are remote, lightweight Giphy embeds. Using <img> keeps it simple and
// avoids configuring remotePatterns in next.config.ts.

const PETS = [
  {
    name: "Biscuit",
    tag: "Reunited in 3 hours",
    quote: "Found napping under a neighbor's porch. Home for dinner.",
    src: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
    alt: "A cat looking curious",
    accent: "primary" as const,
  },
  {
    name: "Mochi",
    tag: "Reunited next day",
    quote: "Someone posted a sighting two blocks away. Match found.",
    src: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif",
    alt: "A cat peeking around a corner",
    accent: "success" as const,
  },
  {
    name: "Chorizo",
    tag: "Reunited within 6 hours",
    quote: "A helper spotted a wagging tail down the street.",
    src: "https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif",
    alt: "A cheerful cat",
    accent: "primary" as const,
  },
  {
    name: "Noodle",
    tag: "Reunited in 2 days",
    quote: "AI matched a photo across town. The family cried, in a good way.",
    src: "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
    alt: "A curious cat investigating something",
    accent: "success" as const,
  },
];

export function MascotsGallery() {
  return (
    <section
      id="pets"
      className="relative scroll-mt-20 border-b border-border bg-card/40"
    >
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        {/* Heading */}
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold text-primary">
              Real reunions
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black leading-tight tracking-tight text-text-primary sm:text-5xl">
              Meet the pets{" "}
              <span className="text-primary">back home.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-text-secondary sm:text-lg">
              Every reunion starts with a fuzzy face. Here are a few pets our
              community has helped bring home.
            </p>
          </div>

          {/* Live indicator */}
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-success/40 bg-card px-3 py-1 text-xs font-semibold text-success sm:self-end">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            4 recent reunions
          </div>
        </div>

        {/* Gallery grid */}
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PETS.map((pet) => {
            const ringHover =
              pet.accent === "success"
                ? "hover:border-success/50"
                : "hover:border-primary/50";
            const badgeColor =
              pet.accent === "success"
                ? "bg-success/10 text-success"
                : "bg-primary/10 text-primary";

            return (
              <li
                key={pet.name}
                className={`group relative overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${ringHover}`}
              >
                {/* Photo */}
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img
                    src={pet.src}
                    alt={pet.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Meta */}
                <div className="border-t border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-text-primary">
                      {pet.name}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeColor}`}
                    >
                      🎉
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-text-secondary">
                    {pet.tag}
                  </div>
                  <p className="mt-2 text-sm leading-snug text-text-secondary">
                    &ldquo;{pet.quote}&rdquo;
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Friendly footnote */}
        <p className="mt-10 text-center text-xs text-text-secondary">
          Stories inspired by real Meowtrix reunions · Treats were shared
        </p>
      </div>
    </section>
  );
}

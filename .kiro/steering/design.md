# UI/UX Design Guidelines

## Design Philosophy

Meowtrix is a warm, friendly community app for reuniting lost pets with their families. The tone is caring, hopeful, and modern — like a well-designed pet care app, not an operations dashboard. Copy should be plain-language and accessible to non-native English speakers. Every screen should feel approachable to a worried owner in the middle of a stressful moment.

Avoid military, spy, or surveillance framing (no "Overlord", "Agent", "Informant", "HQ", "Deploy", "Intel", etc.) in user-facing text. Use plain words: "missing pet", "sighting", "helper" or "member", "home", "post", "notes".

Technical/database names (Overlord, Agent, Informant) may remain in code identifiers, API routes, DB columns, and internal comments — the rebrand is presentational only.

## Color Palette

The app supports two themes: **dark (default)** and **light**. Both palettes are defined as CSS variables in `app/globals.css` and applied via a `dark` / `light` class on `<html>` (managed by `next-themes`).

### Dark theme (default)

- **Background:** `#17141A` (warm dark, not pure black)
- **Card / surface:** `#221E27`
- **Primary (brand):** `#FF8B70` (warm coral) — used for CTAs, active states, brand highlights
- **Accent:** `#FFB865` (warm amber) — secondary highlight
- **Success / Found:** `#6FCC96` (soft mint)
- **Danger / Missing:** `#FF7D7D` (soft coral-red)
- **Text primary:** `#F5EDE4` (warm off-white)
- **Text secondary:** `#B4A99C` (warm gray)
- **Border:** `#382E36`

### Light theme

- **Background:** `#FFF8F2` (warm cream)
- **Card / surface:** `#FFFFFF`
- **Primary (brand):** `#F26E52` (warm coral)
- **Accent:** `#F5A445` (warm amber)
- **Success:** `#3FA36E`, **Danger:** `#E45858`
- **Text primary:** `#2D2A26` (warm charcoal, never pure black)
- **Text secondary:** `#7B7168`
- **Border:** `#F0E4D6`

Reference tokens by their CSS variable names (`--color-primary`, `--color-card`, etc.) or their Tailwind aliases (`bg-primary`, `text-danger`, `border-border`). Do **not** hardcode hex values in components.

## Typography

- Default sans-serif is **Inter** (via next/font), used for body copy, form controls, and navigation.
- Headings use **Space Grotesk** for a friendly-modern feel. Reference via `font-[family-name:var(--font-space-grotesk)]` or the `font-display` token.
- **JetBrains Mono** exists but should be used sparingly — only for record IDs, coordinates, or small technical labels. Avoid mono for anything a first-time visitor reads.
- Prefer sentence case for headings and buttons over ALL CAPS. Reserve uppercase for tiny eyebrow labels and status chips (`text-[10px]` or `text-xs`), never body copy.

## Component Style

- **Rounded corners.** Use Tailwind's `rounded-md` (12px), `rounded-lg` (16px), `rounded-xl` (20px), or `rounded-full` for pills and avatars. The tokens `--radius-*` in `globals.css` define these.
- **Soft shadows.** Use `shadow-soft`, `shadow-md`, or the CSS custom properties `var(--shadow-soft)` / `var(--shadow-md)`. Avoid brutalist offset shadows (`shadow-[Npx_Npx_0px_...]`) in new code.
- **Subtle borders.** 1px `border-border` is the default. Use 2px only for emphasized cards.
- **Warm active states.** Focused inputs and hovered buttons should lift with `translateY(-1px)` + shadow bump. See `.pet-btn-primary` and `.pet-card` helpers in `globals.css`.

## Layout Patterns

- Dashboard-first layout with sidebar navigation on desktop, bottom nav on mobile.
- The map is a prominent hero on the dashboard but framed with a rounded card, not a raw brutalist border.
- Stat cards use soft rounded backgrounds with muted color-tinted icons — playful, not intimidating.
- Match cards, report lists, and leaderboards use generous spacing (`p-4 md:p-6`) and soft dividers.
- Mobile-first responsive: stack sidebar into bottom nav on small screens.

## Interaction & Animation

- Pulsing accent on active tracking pins (see `.meowtrix-avatar-pulse`).
- Gentle transitions on hover: `translateY(-2px)` lift + shadow bump.
- Loading states use `animate-pulse` on soft-rounded skeletons.
- Toasts styled as warm confirmation cards (not "incoming transmissions").
- Optional wiggle on playful mascots via `.meowtrix-wiggle`.

## Copywriting Tone

- Warm, hopeful, plain-language. Speak to worried owners and helpful neighbors, not to spies.
- Short sentences. Prefer verbs over jargon: "Post" over "Deploy", "Notify" over "Transmit", "Reunited" over "Mission Complete".
- Use inclusive terms like "helper", "neighbor", "you", "your pet".
- Sprinkle emojis sparingly (🐾, 🐱, 🐶, ❤️) for warmth in success states — never in error copy.

## Copy Glossary (UI-facing)

Backend / code names stay; UI-facing labels change:

| Backend / code   | UI label                       |
| ---------------- | ------------------------------ |
| Overlord         | Missing pet                    |
| Agent            | Sighting (or spotted pet)      |
| Informant        | Helper / member                |
| HQ               | Home                           |
| Intel / points   | Helper points                  |
| Deploy alert     | Post / share                   |
| Escalating Search Protocol | Search timeline       |
| Reunion / mission complete | Reunited              |

## Accessibility

- Maintain WCAG AA contrast ratios (4.5:1 minimum for body text) in both themes.
- All interactive elements have visible focus rings (`outline: 2px solid var(--color-primary)` + soft glow).
- Provide alt text for map markers and pet images.
- Ensure tables and lists are navigable via keyboard.
- Never rely on color alone to convey status — pair with icons or labels.

## Implementation Rules

- Use Tailwind CSS utility classes and shadcn/ui components. Prefer utility tokens over arbitrary values.
- Never hardcode hex colors in components. Use `bg-card`, `text-primary`, `border-border`, `text-danger`, etc.
- Both light and dark themes must be tested for any new UI. Toggle in Settings.
- Users pick their theme explicitly — do not auto-follow system preference.
- Legacy classes `.brutal-card` / `.brutal-btn` and arbitrary utilities like `rounded-[2px]` / `border-[3px]` are globally softened via `globals.css` for backwards compat. New code should use `rounded-md`/`rounded-lg` and `border` directly.

## Scoring Context

This project is judged on UX/UI (15% weight). To maximize this score:

- The interface must feel warm, welcoming, and intentionally designed.
- Copy must be understandable to non-native English speakers.
- Both themes must be polished, not just the dark one.
- Smooth interactions and cohesive visual language across every screen.

# MEOWTRIX — hackthekitty Theme Design System

> Neo-Brutalism + Bento Grid · Dark Mode · Extracted from hackthekitty.com

---

## Core Principles

| Principle | Rule |
|-----------|------|
| Borders | 3px solid, always visible, never subtle |
| Shadows | Hard offset (4px 4px 0px), zero blur, 100% opacity |
| Corners | 0px radius — sharp, structural, no rounding |
| Typography | Bold, uppercase, geometric sans-serif (Space Grotesk) |
| Colors | High-saturation, flat fills, no gradients |
| Layout | Bento grid — modular blocks with variable sizing |
| Interaction | Mechanical press — element shifts into its own shadow |

---

## Color Palette

### Primary Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-background` | `#0A0A0F` | Page canvas |
| `--color-card` | `#1A1A2E` | Card/panel surfaces |
| `--color-accent` | `#FFCC00` | Primary CTA, ring, focus |
| `--color-text-primary` | `#E6E6E6` | Body text |
| `--color-text-secondary` | `#8892B0` | Muted labels |

### Neo-Brutalist Accents

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-brutal-yellow` | `#FFDE4D` | Borders, shadows, headings |
| `--color-brutal-orange` | `#FF9F1C` | Active searches, timeline |
| `--color-brutal-pink` | `#FF6B97` | Alerts, danger emphasis |
| `--color-brutal-mint` | `#51E5A5` | Online/success states, hover accent |

### Semantic

| State | Color | Shadow Color |
|-------|-------|--------------|
| Default | `#FFDE4D` border | `#FFDE4D` shadow |
| Danger | `#FF4444` border | `#FF4444/50` shadow |
| Success | `#51E5A5` border | `#51E5A5` shadow |
| Hover (nav) | `#51E5A5` | `#51E5A5` shadow |

---

## Typography

| Role | Font | Weight | Transform |
|------|------|--------|-----------|
| Display/Headings | Space Grotesk | 700 | `uppercase tracking-wider` |
| Body | Inter | 400–500 | Normal |
| Data/Stats/Mono | JetBrains Mono | 400–500 | Normal |
| Labels/Tags | Inter or Mono | 700 | `uppercase tracking-wide` |

### Google Fonts Import

```css
--font-display: "Space Grotesk", sans-serif;
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

---

## Borders & Shadows

### CSS Tokens

```css
--shadow-brutal: 4px 4px 0px #000;
--border-brutal: 3px solid currentColor;
```

### Dark Mode Adaptation

On dark backgrounds (`#0A0A0F`), black shadows are invisible. Use accent-colored shadows:

```
shadow-[4px_4px_0px_#FFDE4D]     /* primary cards */
shadow-[3px_3px_0px_#51E5A5]     /* hover state */
shadow-[3px_3px_0px_#FF4444]     /* danger state */
```

### Border Hierarchy

| Element | Border Width | Border Color |
|---------|-------------|--------------|
| Cards, panels, map | 3px | `#FFDE4D` |
| Nav items (active) | 2px | `#FFDE4D` |
| Nav items (hover) | 2px | `#51E5A5` |
| Inputs (focus) | 3px | `accent` |
| Sidebar/bottom nav | 3px | `#FFDE4D` |

---

## Interaction: Mechanical Press

Buttons and interactive cards "press into" their shadow on click:

```css
/* Resting */
box-shadow: 4px 4px 0px #FFDE4D;
transform: translate(0, 0);

/* Active/Pressed */
box-shadow: 0px 0px 0px #FFDE4D;
transform: translate(4px, 4px);

/* Transition */
transition: transform 0.1s, box-shadow 0.1s;
```

Tailwind implementation:

```
shadow-[4px_4px_0px_#FFDE4D]
active:translate-x-[4px] active:translate-y-[4px] active:shadow-none
```

---

## Layout: Bento Grid

### Dashboard Structure

```
┌──────────────────────────────────────────────┐
│  HQ DASHBOARD (Space Grotesk, bold, yellow)  │
├──────────┬──────────┬──────────┬─────────────┤
│ Overlords│ Searches │ Online   │  (optional) │
│ Tracked  │ Active   │ Agents   │             │
├──────────┴──────────┴──────────┴─────────────┤
│                                              │
│         ┌─ LIVE OPERATIONS MAP ─┐            │
│         │                       │            │
│         │   (Leaflet full-w)    │            │
│         │                       │            │
│         └───────────────────────┘            │
└──────────────────────────────────────────────┘
```

### Grid Classes

```
grid grid-cols-2 gap-4 lg:grid-cols-4 auto-rows-auto
```

---

## Component Styles

### Button (Default/Brutal)

```
border-3 border-accent bg-accent text-primary-foreground
shadow-[4px_4px_0px_0px] shadow-accent/60
rounded-none font-bold uppercase tracking-wide
active:translate-x-[4px] active:translate-y-[4px] active:shadow-none
```

### Card

```
rounded-none border-3 border-accent/50 bg-card
shadow-[4px_4px_0px_0px] shadow-accent/30
```

### Input

```
rounded-none border-3 border-accent/50 bg-transparent
shadow-[3px_3px_0px_0px] shadow-accent/20
focus:border-accent focus:shadow-accent/40
```

### Nav Item (Active)

```
border-[2px] border-[#FFDE4D] bg-[#FFDE4D]/10 text-[#FFDE4D]
shadow-[3px_3px_0px_#FFDE4D]
```

### Nav Item (Hover)

```
border-[2px] border-[#51E5A5] text-[#51E5A5]
shadow-[3px_3px_0px_#51E5A5]
```

---

## Utility Classes (globals.css)

```css
.brutal-card {
  border: 3px solid currentColor;
  box-shadow: 4px 4px 0px #000;
  background-color: var(--color-card);
}

.brutal-btn {
  border: 3px solid currentColor;
  box-shadow: 4px 4px 0px #000;
  transition: transform 0.1s, box-shadow 0.1s;
  cursor: pointer;
}
.brutal-btn:active {
  transform: translate(4px, 4px);
  box-shadow: 0px 0px 0px #000;
}
```

---

## Accessibility

- Focus ring: `outline: 2px solid #FFCC00` + `box-shadow: 0 0 0 4px rgba(255,204,0,0.2)`
- Minimum touch targets: 44×44px
- All text contrast ≥ 4.5:1 against `#0A0A0F` / `#1A1A2E`
- `prefers-reduced-motion`: disable translate animations
- Keyboard nav: visible border-based focus states (inherently high-contrast in brutalism)

---

## Files Modified

| File | Change |
|------|--------|
| `app/globals.css` | Design tokens, utility classes |
| `app/layout.tsx` | Space Grotesk font added |
| `components/ui/button.tsx` | Brutal variant + press effect |
| `components/ui/card.tsx` | Hard shadow + thick border |
| `components/ui/input.tsx` | Brutalist input styling |
| `components/dashboard/StatCard.tsx` | Bento card with hover shift |
| `components/dashboard/StatGrid.tsx` | Bento grid layout + accent colors |
| `components/layout/Sidebar.tsx` | 3px borders, nav shadow states |
| `components/layout/BottomNav.tsx` | Thick top border, active boxes |
| `app/(protected)/dashboard/page.tsx` | Bento grid + corner label on map |
| `app/(protected)/leaderboard/page.tsx` | Full brutalist treatment |
| `app/(auth)/layout.tsx` | Space Grotesk heading |

---

## Source References

- **Visual extraction:** `docs/design/visual-extraction.md`
- **ui-ux-pro-max results:** Neubrutalism style (border: 3px solid #000, box-shadow: 5px 5px 0px), Kinetic Brutalism typography (Space Grotesk 700–900)
- **Project design steering:** `.kiro/steering/design.md`

---
inclusion: always
---

# UI/UX Design Guidelines

## Design Philosophy

The visual identity is "Feline Overlord Tracker" — a tongue-in-cheek spy-agency dashboard for tracking cats. The tone should feel like a modern surveillance command center, but playful and cat-themed. Think dark ops meets cat memes.

## Color Palette

- **Background:** High-contrast dark mode (`#0A0A0F` base, `#1A1A2E` cards/panels)
- **Primary accent:** Bold yellow (`#FFCC00` or `#FFD700`) for CTAs, active states, and highlights
- **Secondary accent:** Cool gray (`#8892B0`) for muted text and borders
- **Success/Online:** Neon green (`#00FF88`) for active tracking indicators
- **Danger/Alert:** Red (`#FF4444`) for missing-cat alerts and escalation states
- **Text:** White (`#E6E6E6`) primary, gray (`#8892B0`) secondary

## Typography

- Use a monospace or terminal-style font (e.g., JetBrains Mono, Fira Code) for data tables, stat counters, and reference IDs
- Use the default sans-serif (Inter via shadcn/ui) for body text and navigation
- Headings should feel bold and impactful — uppercase where appropriate for section headers

## Component Style

- Sharp edges, minimal border-radius (2px max on cards, 0px on data tables)
- Glowing active states: apply `box-shadow` with yellow or green glow on focused/active elements
- Subtle scan-line or grid-pattern backgrounds on hero sections
- Cards and panels should use subtle borders (`border-zinc-800`) rather than heavy shadows
- Buttons: filled yellow for primary actions, outlined/ghost for secondary

## Layout Patterns

- Dashboard-first layout: prioritize information density with a sidebar navigation pattern
- Map view is the hero — give Leaflet the largest viewport area
- Use a grid layout for stat cards (cats tracked, active searches, informants online)
- Leaderboard uses a data-table style with terminal-font rows and rank indicators
- Mobile-first responsive: stack sidebar into bottom nav on small screens

## Interaction & Animation

- Pulsing dot animations on active tracking pins
- Subtle fade/slide transitions on page navigation (no jarring jumps)
- Loading states should use cat-themed skeleton screens or scanning animations
- Toast notifications styled as "incoming transmissions" for real-time alerts

## Copywriting Tone

- Spy/military jargon adapted for cats: "agents" (found cats), "overlords" (lost cats), "informants" (users), "HQ" (dashboard)
- Keep it light and fun — never actually intimidating
- Short, punchy labels. Prefer "Deploy Alert" over "Send Notification"

## Accessibility

- Maintain WCAG AA contrast ratios (4.5:1 minimum for body text against dark backgrounds)
- All interactive elements must have visible focus states (yellow glow ring)
- Provide alt text for map markers and cat images
- Ensure the leaderboard and data tables are navigable via keyboard

## Implementation Rules

- Use exclusively Tailwind CSS utility classes and shadcn/ui components
- Never use inline styles or custom CSS files for layout/theming
- Dark mode is the only mode — do not implement a light theme toggle
- All color values should be defined in the Tailwind config `extend.colors` section for consistency
- Reference the hackthekitty.com visual language: bold headlines, high contrast, punchy sections with clear visual hierarchy

## Scoring Context

This project is judged on UX/UI (15% weight). To maximize this score:
- The interface must look intentionally designed, not default/boilerplate
- Smooth interactions, clear navigation, and cohesive visual style are explicitly scored
- Polish over feature count — a refined 3-screen app beats a rough 10-screen app
- The video demo is what judges see first, so hero screens must be visually striking

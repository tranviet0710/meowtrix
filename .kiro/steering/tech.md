---
inclusion: always
---

# Tech Stack & Architecture

## Core Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS with shadcn/ui components
- **Database & Auth:** Supabase (PostgreSQL, Auth, Storage)
- **Mapping:** Leaflet.js with OpenStreetMap tiles
- **Background Workflows:** Temporal (Escalating Search Protocol)
- **Security Scanning:** Aikido (SAST, Dependency Scanning)
- **AI Vision:** Gemini API for image tagging and cat trait extraction
- **Hosting:** Vercel (Hobby tier)

## Architecture Conventions

- Use Next.js App Router (`app/` directory) with Server Components by default; mark client components explicitly with `"use client"`.
- API routes live under `app/api/` and handle Supabase interactions server-side.
- Supabase client is initialized via environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Temporal workflows and activities are co-located in a `temporal/` directory at the project root.
- Leaflet map components must be dynamically imported with `next/dynamic` and `ssr: false`.

## Code Style

- TypeScript strict mode enabled.
- Prefer named exports over default exports.
- Use `interface` for object shapes; use `type` for unions and intersections.
- Component files use PascalCase (e.g., `MapView.tsx`). Utility files use camelCase (e.g., `supabaseClient.ts`).
- Keep components small and composable. Extract hooks into a `hooks/` directory.

## Dependencies & Security

- Pin dependency versions exactly (no `^` or `~` ranges).
- Never commit secrets or API keys. Use `.env.local` for local development.
- Aikido is connected to the GitHub repo for continuous scanning. Address any flagged vulnerabilities before merging.

## Key Patterns

- Supabase Row Level Security (RLS) policies must be enabled on all tables.
- Authentication flows use Supabase Auth with email/password and optional OAuth.
- Image uploads go to Supabase Storage; the Gemini API processes them for trait extraction.
- The Temporal "Escalating Search Protocol" workflow manages time-delayed notifications (6h, 24h, 48h tiers).
- Leaflet heatmap overlays represent "High Probability Zones" based on roaming distance calculations.

<![CDATA[<div align="center">

```
███╗   ███╗███████╗ ██████╗ ██╗    ██╗████████╗██████╗ ██╗██╗  ██╗
████╗ ████║██╔════╝██╔═══██╗██║    ██║╚══██╔══╝██╔══██╗██║╚██╗██╔╝
██╔████╔██║█████╗  ██║   ██║██║ █╗ ██║   ██║   ██████╔╝██║ ╚███╔╝ 
██║╚██╔╝██║██╔══╝  ██║   ██║██║███╗██║   ██║   ██╔══██╗██║ ██╔██╗ 
██║ ╚═╝ ██║███████╗╚██████╔╝╚███╔███╔╝   ██║   ██║  ██║██║██╔╝ ██╗
╚═╝     ╚═╝╚══════╝ ╚═════╝  ╚══╝╚══╝    ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
```

**`> FELINE OVERLORD TRACKER v1.0`**

**`> STATUS: OPERATIONAL`**

<br>

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Temporal](https://img.shields.io/badge/Temporal-000000?style=for-the-badge&logo=temporal&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## 📡 Mission Briefing

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   MEOWTRIX is a real-time intelligence platform for tracking    │
│   and recovering lost feline overlords. Powered by AI vision,   │
│   predictive heatmaps, and escalating search protocols.         │
│                                                                 │
│   Your overlord is out there. We will find them.                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           MEOWTRIX HQ                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│   │  DASHBOARD  │    │   MAP HQ    │    │ LEADERBOARD │                │
│   │  (Next.js)  │    │ (Leaflet)   │    │  (Realtime) │                │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                │
│          │                  │                   │                        │
│          └──────────────────┼───────────────────┘                        │
│                             │                                            │
│                    ┌────────▼────────┐                                   │
│                    │   API ROUTES    │                                   │
│                    │  (App Router)   │                                   │
│                    └────────┬────────┘                                   │
│                             │                                            │
│          ┌──────────────────┼──────────────────┐                        │
│          │                  │                  │                        │
│   ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐                 │
│   │  SUPABASE   │   │   GEMINI    │   │  TEMPORAL   │                 │
│   │  Auth + DB  │   │  AI Vision  │   │  Workflows  │                 │
│   │  + Storage  │   │  Tagging    │   │  Protocol   │                 │
│   └─────────────┘   └─────────────┘   └─────────────┘                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Operations

| Operation | Codename | Description |
|-----------|----------|-------------|
| 🔴 Report Lost | `OVERLORD_DOWN` | File a report with photos, location, and traits |
| 🟢 Report Found | `AGENT_SPOTTED` | Log a sighting with AI-powered trait extraction |
| 🧠 AI Matching | `PATTERN_LOCK` | Gemini vision compares traits for matchmaking |
| 🗺️ Heatmap | `ZONE_PREDICT` | Probability zones expand over time on the map |
| ⏰ Escalation | `SEARCH_PROTOCOL` | Temporal workflows: 6h → 24h → 48h notifications |
| ✅ Verification | `CLAIM_VERIFY` | 3-question challenge to confirm identity |

---

## 🚀 Deployment

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
TEMPORAL_ADDRESS=your_temporal_address
```

### Launch Sequence

```bash
# Clone the intel
git clone https://github.com/your-username/meowtrix.git
cd meowtrix

# Install dependencies
npm install

# Initialize database
npx supabase db push

# Seed demo data
npx ts-node scripts/seed.ts

# Deploy locally
npm run dev
```

```
> SYSTEM ONLINE AT http://localhost:3000
> AWAITING FIELD REPORTS...
```

---

## 🛡️ Security Clearance

```
┌─────────────────────────────────────────────────┐
│  AIKIDO SECURITY STATUS                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ■ SAST Scanning ................ ACTIVE        │
│  ■ Dependency Audit ............. ACTIVE        │
│  ■ RLS Policies ................. ENFORCED      │
│  ■ Claim Verification ........... 3-STEP        │
│  ■ Upload Validation ............ STRICT        │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Row Level Security on all Supabase tables
- Multi-step claim verification before overlord recovery
- Image format & size validation (JPEG/PNG/WebP, ≤5MB)
- No secrets in client bundles — server-side only API keys
- Continuous scanning via Aikido connected to GitHub

---

## 📊 Match Engine Scoring

```
MATCH CONFIDENCE BREAKDOWN
══════════════════════════════════════════

  Visual Similarity   ████████████████░░░░  40%
  Text Comparison     ██████████░░░░░░░░░░  25%
  Proximity Score     ██████████░░░░░░░░░░  25%
  Other Traits        ████░░░░░░░░░░░░░░░░  10%

══════════════════════════════════════════
  THRESHOLD: ≥ 60/100 to generate alert
  MAX SUGGESTIONS: 10 per overlord
```

---

## ⏱️ Escalating Search Protocol

```
TIME ─────────────────────────────────────────────────▶

 0h          6h              24h             48h         14d
 │           │               │               │           │
 ▼           ▼               ▼               ▼           ▼
 ┌───┐      ┌───────┐      ┌───────┐      ┌───────┐   ┌────┐
 │ ! │      │NOTIFY │      │POSTER │      │EXPAND │   │END │
 │RPT│      │ 1km   │      │  PDF  │      │ 5km   │   │    │
 └───┘      └───────┘      └───────┘      └───────┘   └────┘
  Filed      Nearby          Auto-gen       Wider       Search
  Report     Informants      Missing        Radius      Concluded
             Alerted         Poster         Alert
```

---

## 🗂️ Project Structure

```
meowtrix/
├── app/
│   ├── (auth)/             # Login & Registration
│   ├── (protected)/        # Dashboard, Map, Reports, Leaderboard
│   └── api/                # Server-side routes
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── map/                # Leaflet map components
│   ├── forms/              # Report & claim forms
│   └── leaderboard/        # Ranking table
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities & algorithms
├── temporal/               # Workflow definitions
├── types/                  # TypeScript interfaces
└── scripts/                # Seed & utility scripts
```

---

## 🏆 Informant Leaderboard

```
╔══════╦════════════════════╦════════╦═══════════╗
║ RANK ║ CODENAME           ║ POINTS ║ RECOVERIES║
╠══════╬════════════════════╬════════╬═══════════╣
║  01  ║ ██████████████     ║   120  ║     12    ║
║  02  ║ ████████████       ║    90  ║      9    ║
║  03  ║ ██████████         ║    70  ║      7    ║
║  04  ║ ████████           ║    50  ║      5    ║
║  05  ║ ██████             ║    30  ║      3    ║
╚══════╩════════════════════╩════════╩═══════════╝
```

+10 points per verified recovery. Ties broken by earliest match timestamp.

---

## 🔧 Built With

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI Vision | Google Gemini API |
| Maps | Leaflet.js + OpenStreetMap |
| Workflows | Temporal |
| Security | Aikido (SAST + Deps) |
| Hosting | Vercel |

---

## 📜 License

MIT

---

<div align="center">

```
╔═══════════════════════════════════════════╗
║                                           ║
║   MEOWTRIX — TRUST NO ONE. FIND THEM.    ║
║                                           ║
╚═══════════════════════════════════════════╝
```

</div>
]]>
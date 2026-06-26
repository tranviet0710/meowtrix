# Implementation Plan: MEOWTRIX — Feline Overlord Tracker

## Overview

This plan implements the MEOWTRIX spy-agency themed web application for tracking and recovering lost cats. The implementation follows a bottom-up approach: foundational infrastructure first (project setup, database, auth), then core subsystems (image handling, AI vision, match engine), followed by UI components and workflows, and finally integration wiring.

## Tasks

- [ ] 1. Project setup and core infrastructure
  - [ ] 1.1 Initialize Next.js project with TypeScript, Tailwind CSS, and shadcn/ui
    - Create Next.js App Router project with TypeScript strict mode
    - Configure Tailwind with custom dark-mode color palette (#0A0A0F background, #FFCC00 accent, #8892B0 secondary, #00FF88 success, #FF4444 danger)
    - Install and configure shadcn/ui components
    - Set up JetBrains Mono font for data displays and Inter for body text
    - Configure environment variables structure (.env.local with Supabase, Gemini, Temporal vars)
    - _Requirements: 11.4, 12.4, 13.6_

  - [ ] 1.2 Define shared TypeScript interfaces and Zod validation schemas
    - Create `types/index.ts` with all interfaces (Informant, Overlord, Agent, TraitTags, MatchSuggestion, Claim, Notification, LeaderboardEntry)
    - Create `lib/validators.ts` with Zod schemas for form validation (overlord form, agent form, photo upload, claim answers, settings)
    - _Requirements: 2.1, 2.6, 3.1, 3.7, 9.1, 14.1_

  - [ ] 1.3 Set up Supabase database schema and RLS policies
    - Create SQL migration for all tables (informants, overlords, agents, match_suggestions, claims, notifications)
    - Enable RLS on all tables with policies per design (owner-only write, authenticated read)
    - Create database function for verification field comparison (never expose values)
    - Configure Supabase Storage buckets (cat-photos, posters) with access policies
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.10_

  - [ ] 1.4 Set up Supabase client utilities
    - Create `lib/supabaseClient.ts` (browser client)
    - Create `lib/supabaseServer.ts` (server client with service role)
    - Create middleware.ts for session validation and protected route redirect
    - _Requirements: 1.7, 1.8, 13.8_

  - [ ] 1.5 Set up testing framework (Vitest + fast-check)
    - Configure Vitest with TypeScript support
    - Install fast-check for property-based testing
    - Create test directory structure
    - _Requirements: N/A (testing infrastructure)_

- [ ] 2. Authentication subsystem
  - [ ] 2.1 Implement registration API route and location consent flow
    - Create `app/api/auth/register/route.ts` with email/password registration via Supabase Auth
    - Create informant row on successful signup
    - Implement location consent step with map picker support (store lat/lng or null based on consent)
    - Validate email format, password 8-128 chars, display name
    - _Requirements: 1.1, 1.2, 1.9, 1.11, 1.12_

  - [ ] 2.2 Implement login and OAuth API routes
    - Create `app/api/auth/login/route.ts` with Supabase signInWithPassword
    - Create `app/api/auth/callback/route.ts` for OAuth providers (Google, GitHub)
    - Return generic error messages on invalid credentials (no email/password hints)
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.10_

  - [ ] 2.3 Build authentication UI pages
    - Create `app/(auth)/layout.tsx` (centered card layout, no sidebar)
    - Create `app/(auth)/login/page.tsx` with email/password form and OAuth buttons
    - Create `app/(auth)/register/page.tsx` with registration form
    - Create `app/(auth)/register/location-consent/page.tsx` with map picker and consent toggle
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [ ]* 2.4 Write property test for authentication enforcement
    - **Property 20: Authentication enforcement**
    - **Validates: Requirements 13.8**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Image upload and optimization subsystem
  - [ ] 4.1 Implement image optimizer utility
    - Create `lib/imageOptimizer.ts` using sharp library
    - Implement JPEG/PNG → WebP conversion (quality 75, target 40%+ reduction)
    - Implement WebP re-compression (quality 80, target 20%+ reduction)
    - Implement downscaling (longest edge > 2048px → 2048px, maintain aspect ratio, min 800px)
    - Implement SSIM threshold check (≥ 0.85)
    - Handle 10-second timeout with fallback to original
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

  - [ ]* 4.2 Write property test for image dimension constraints
    - **Property 21: Image dimension constraints**
    - **Validates: Requirements 14.4, 14.5**

  - [ ] 4.3 Implement upload API route
    - Create `app/api/upload/route.ts`
    - Validate file format (JPEG/PNG/WebP) and size (≤5MB)
    - Call imageOptimizer, upload result to Supabase Storage cat-photos bucket
    - Return public URL
    - _Requirements: 2.3, 2.4, 3.3, 3.4, 14.1_

  - [ ]* 4.4 Write property test for photo upload validation
    - **Property 2: Photo upload validation**
    - **Validates: Requirements 2.3, 3.3, 3.7**

  - [ ] 4.5 Build PhotoUploader component
    - Create `components/forms/PhotoUploader.tsx` (client component)
    - Support multi-file upload (1-5 photos), drag & drop, preview thumbnails
    - Display inline validation errors for invalid format/size
    - Show upload progress indicator
    - _Requirements: 2.3, 2.6, 3.3, 3.7_

- [ ] 5. AI Vision tagging subsystem
  - [ ] 5.1 Implement Gemini API client and vision processing
    - Create `lib/gemini.ts` with structured prompt for trait extraction
    - Create `app/api/vision/process/route.ts` to trigger processing
    - Implement 30-second timeout with single retry, mark as manual_review on double failure
    - Store extracted TraitTags on the record, update tagging_status
    - Handle incomplete responses (mark as incomplete tagging)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6_

  - [ ] 5.2 Implement trait tag merging logic
    - Add merge function to handle multi-photo tag consolidation
    - Frequency-based selection for single-value fields
    - Tie-breaking by most recently uploaded photo
    - Combine and trim distinguishing_features to max 5
    - _Requirements: 4.3, 4.7_

  - [ ]* 5.3 Write property test for Gemini response parsing
    - **Property 3: Gemini response parsing**
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 5.4 Write property test for trait tag merging
    - **Property 4: Trait tag merging**
    - **Validates: Requirements 4.3, 4.7**

- [ ] 6. Match engine subsystem
  - [ ] 6.1 Implement geodesic distance and proximity scoring utilities
    - Create `lib/geodesic.ts` with haversine distance function
    - Implement proximity score: ≤500m → 100, 500m–10km → linear interpolation, >10km → 0
    - _Requirements: 7.8, 8.8_

  - [ ]* 6.2 Write property test for geodesic distance function
    - **Property 7: Geodesic distance function**
    - **Validates: Requirements 7.8, 8.8**

  - [ ]* 6.3 Write property test for proximity score formula
    - **Property 9: Proximity score formula**
    - **Validates: Requirements 8.8**

  - [ ] 6.4 Implement match scoring algorithm
    - Create `lib/matchEngine.ts` with calculateMatchScore function
    - Implement visual similarity (40% weight) comparing trait tag fields
    - Implement text similarity (25% weight) using Jaccard token overlap
    - Integrate proximity score (25% weight)
    - Implement other fields score (10% weight) for breed/fur comparison
    - Threshold: persist matches ≥ 60, max 10 per Overlord, prevent duplicates
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.8, 8.9, 8.10, 8.11_

  - [ ]* 6.5 Write property test for match score weighted formula
    - **Property 8: Match score weighted formula**
    - **Validates: Requirements 8.1**

  - [ ]* 6.6 Write property test for match threshold and ranking
    - **Property 10: Match threshold and ranking**
    - **Validates: Requirements 8.3, 8.5**

  - [ ]* 6.7 Write property test for no duplicate match suggestions
    - **Property 11: No duplicate match suggestions**
    - **Validates: Requirements 8.10**

  - [ ] 6.8 Implement match API routes
    - Create `app/api/matches/route.ts` (GET list matches for user)
    - Create `app/api/matches/[id]/route.ts` (GET match detail)
    - Trigger match engine when new records get trait tags
    - Send notifications via Notification_Service on new match suggestions
    - _Requirements: 8.3, 8.4, 8.6, 8.9_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Heatmap engine subsystem
  - [ ] 8.1 Implement heatmap radius calculation utility
    - Create `lib/heatmapCalc.ts` with radius formula: max(200, min(5000, 250 × elapsed_hours))
    - Only display when elapsed > 30 minutes
    - Implement re-centering logic when Agent sighting falls within zone
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7_

  - [ ]* 8.2 Write property test for heatmap radius calculation
    - **Property 5: Heatmap radius calculation**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 8.3 Write property test for heatmap re-centering
    - **Property 6: Heatmap re-centering on Agent sighting**
    - **Validates: Requirements 6.5, 6.7**

  - [ ] 8.4 Build HeatmapOverlay map component
    - Create `components/map/HeatmapOverlay.tsx` (client component)
    - Render Leaflet circle with gradient opacity (0.6 center → 0 edge)
    - Recalculate radius every 5 minutes via setInterval
    - Remove overlay when Overlord resolved (driven by Realtime subscription)
    - _Requirements: 6.3, 6.4, 6.6_

- [ ] 9. Claim verification subsystem
  - [ ] 9.1 Implement claim verification logic and API routes
    - Create `app/api/matches/[id]/claim/route.ts` (POST initiate claim, verify claimant is owner)
    - Create `app/api/claims/[id]/verify/route.ts` (POST submit answers)
    - Implement case-insensitive substring matching (min 3 chars)
    - Implement 2/3 correct threshold for verification
    - Implement lockout after 3 failures (24-hour lock)
    - Handle resolution flow: cancel workflows, reject pending claims, resolve linked Agent
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [ ]* 9.2 Write property test for claim verification substring matching
    - **Property 12: Claim verification substring matching**
    - **Validates: Requirements 9.2**

  - [ ]* 9.3 Write property test for claim verification decision
    - **Property 13: Claim verification decision**
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 9.4 Write property test for claim lockout enforcement
    - **Property 14: Claim lockout enforcement**
    - **Validates: Requirements 9.5**

  - [ ]* 9.5 Write property test for owner-only resolution
    - **Property 15: Owner-only resolution**
    - **Validates: Requirements 9.8**

- [ ] 10. Escalating Search Protocol (Temporal)
  - [ ] 10.1 Implement Temporal workflow and activities
    - Create `temporal/workflows/searchProtocol.ts` with escalation stages (6h, 24h, 48h, 14d)
    - Create `temporal/activities/sendNotification.ts` (query nearby informants with location_consent=true)
    - Create `temporal/activities/generatePoster.ts` (A4 PDF with cat info using pdfkit or @react-pdf/renderer)
    - Create `temporal/activities/findNearbyInformants.ts` (proximity query, exclude opted-out users)
    - Create `temporal/worker.ts` entry point
    - Implement cancellation on Overlord resolution
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ] 10.2 Implement notification service
    - Create `app/api/notifications/route.ts` (GET notifications for user)
    - Store notifications in database with type, title, body, metadata
    - Support notification types: match_alert, escalation, claim_verified, claim_rejected, overlord_resolved, search_concluded
    - _Requirements: 7.2, 7.4, 7.9, 8.4, 9.3, 9.4, 9.9_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Interactive map subsystem
  - [ ] 12.1 Build core MapView component with dynamic import
    - Create `components/map/MapView.tsx` with Leaflet.js and OpenStreetMap tiles
    - Use `next/dynamic` with `ssr: false` for Leaflet import
    - Implement zoom (levels 3-18) and panning
    - Implement map center fallback logic: geolocation → residential coords → Bangkok default
    - Display loading skeleton during data fetch, error with retry on timeout (>10s)
    - _Requirements: 5.1, 5.4, 5.6, 5.7, 5.9_

  - [ ]* 12.2 Write property test for map center fallback logic
    - **Property 22: Map center fallback logic**
    - **Validates: Requirements 5.7**

  - [ ] 12.3 Build MapMarker and MapPopup components
    - Create `components/map/MapMarker.tsx` with differentiated colors (Overlords vs Agents)
    - Create `components/map/MapPopup.tsx` with photo thumbnail (80×80px), name/description, locale-formatted timestamp
    - Add pulsing animation for unresolved Overlord pins (1-2 second cycle)
    - Display empty-state message when no records exist
    - _Requirements: 5.2, 5.3, 5.5, 5.8_

- [ ] 13. Report forms and CRUD API routes
  - [ ] 13.1 Implement Overlord CRUD API routes
    - Create `app/api/overlords/route.ts` (POST create with verification fields, GET list with filters)
    - Create `app/api/overlords/[id]/route.ts` (GET detail excluding verification fields for non-owners, PATCH update owner-only, DELETE owner-only)
    - Trigger Search Protocol on creation
    - Trigger Vision Service on photo upload
    - _Requirements: 2.1, 2.4, 2.5, 2.7, 2.8, 2.9, 13.2, 13.4, 13.5_

  - [ ]* 13.2 Write property test for Overlord form validation
    - **Property 1: Overlord form validation**
    - **Validates: Requirements 2.1, 2.6**

  - [ ]* 13.3 Write property test for verification fields access control
    - **Property 19: Verification fields access control**
    - **Validates: Requirements 2.9, 13.5**

  - [ ] 13.4 Implement Agent CRUD API routes
    - Create `app/api/agents/route.ts` (POST create with system-generated timestamp, GET list)
    - Create `app/api/agents/[id]/route.ts` (GET detail, PATCH reporter-only, DELETE reporter-only)
    - Trigger Vision Service on photo upload
    - Trigger Match Engine after trait tags available
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 13.2_

  - [ ] 13.5 Build Lost Overlord report form UI
    - Create `app/(protected)/report-lost/page.tsx`
    - Create `components/forms/LostOverlordForm.tsx` with cat name, description, photo upload, map pin, timestamp, verification questions
    - Inline validation errors per field
    - Retain form data on failure, clear on success and navigate to new record
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.8, 2.9_

  - [ ] 13.6 Build Spotted Agent report form UI
    - Create `app/(protected)/report-found/page.tsx`
    - Create `components/forms/SpottedAgentForm.tsx` with photo upload, map pin, optional description
    - Inline validation errors, retain data on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_

- [ ] 14. Dashboard, layout, and navigation
  - [ ] 14.1 Build protected layout with sidebar and bottom nav
    - Create `app/(protected)/layout.tsx` with dark-mode command-center aesthetic
    - Create `components/layout/Sidebar.tsx` (desktop) with nav links and active state (#FFCC00)
    - Create `components/layout/BottomNav.tsx` (mobile <768px) with all nav items
    - Ensure 44×44px minimum tap targets on mobile
    - _Requirements: 11.3, 11.4, 12.1, 12.3, 12.4_

  - [ ] 14.2 Build HQ Dashboard page
    - Create `app/(protected)/dashboard/page.tsx`
    - Create `components/dashboard/StatGrid.tsx` and `StatCard.tsx` with loading skeletons
    - Display stats: total Overlords, active searches, Informants online (refresh every 30s)
    - Integrate MapView as hero component (≥60% viewport on desktop)
    - Create `app/api/stats/route.ts` for dashboard data
    - Handle fetch timeout (>10s) with error indicator and retry button
    - _Requirements: 11.1, 11.2, 11.4, 11.6, 11.7_

  - [ ] 14.3 Build toast notification system
    - Create `components/layout/ToastQueue.tsx` (client component)
    - Max 3 visible toasts, 5-second auto-dismiss, FIFO queue for overflow
    - Style as "incoming transmissions" with spy theme
    - Subscribe to Supabase Realtime for live notifications
    - Position above bottom nav on mobile
    - _Requirements: 11.5, 12.7_

  - [ ]* 14.4 Write property test for toast notification queue
    - **Property 18: Toast notification queue**
    - **Validates: Requirements 11.5**

- [ ] 15. Leaderboard and points system
  - [ ] 15.1 Implement leaderboard API and points logic
    - Create `app/api/leaderboard/route.ts` (GET paginated, 50 per page)
    - Implement +10 points award on verified claim
    - Sort by total_points descending, tie-break by earliest first_match_at
    - Subscribe to Realtime for live updates (within 5 seconds)
    - _Requirements: 10.1, 10.2, 10.5_

  - [ ]* 15.2 Write property test for points calculation
    - **Property 16: Points calculation**
    - **Validates: Requirements 10.1**

  - [ ]* 15.3 Write property test for leaderboard ordering
    - **Property 17: Leaderboard ordering**
    - **Validates: Requirements 10.2**

  - [ ] 15.4 Build leaderboard UI
    - Create `app/(protected)/leaderboard/page.tsx`
    - Create `components/leaderboard/LeaderboardTable.tsx` with monospace font, rank indicators
    - Highlight current user's row
    - Pagination controls for entries beyond 50
    - Empty state when no points earned
    - Create `components/leaderboard/ShareButton.tsx` with social sharing (Facebook, Twitter/X, LINE)
    - Generate Open Graph preview card with top 3 and MEOWTRIX branding
    - _Requirements: 10.2, 10.3, 10.4, 10.6, 10.7, 10.8, 10.9_

- [ ] 16. Matches and claim verification UI
  - [ ] 16.1 Build matches list and detail pages
    - Create `app/(protected)/matches/page.tsx` with MatchCard list
    - Create `app/(protected)/matches/[id]/page.tsx` with match detail and claim button
    - Create `components/matches/MatchCard.tsx` with score percentage display
    - Create `components/matches/ScoreBreakdown.tsx` with visual component scores
    - _Requirements: 8.3, 8.5, 8.7_

  - [ ] 16.2 Build claim verification form UI
    - Create `components/forms/ClaimVerificationForm.tsx` with 3 verification questions
    - Display result (verified/rejected) without revealing which answers were wrong
    - Show lockout state when 3 failures reached
    - _Requirements: 9.1, 9.4, 9.5_

- [ ] 17. Settings and profile pages
  - [ ] 17.1 Build settings page with location consent management
    - Create `app/(protected)/settings/page.tsx`
    - Create `components/forms/LocationConsentForm.tsx` with toggle and map picker
    - Create `app/api/settings/route.ts` (GET/PATCH) with validation
    - When toggled ON: show map picker, save coordinates
    - When toggled OFF: clear coordinates to null
    - _Requirements: 1.2, 1.11, 1.12_

  - [ ] 17.2 Build profile and record detail pages
    - Create `app/(protected)/profile/page.tsx`
    - Create `app/(protected)/overlords/[id]/page.tsx` (detail view with poster download link)
    - Create `app/(protected)/agents/[id]/page.tsx` (detail view)
    - _Requirements: 7.7, 9.7_

- [ ] 18. Seed data
  - [ ] 18.1 Implement seed data script
    - Create `scripts/seed.ts` with 5 Informants, 15 Overlords, 10 Agents, pre-generated trait tags
    - Create 3 match suggestions (scores: 85, 72, 55)
    - Create 2 leaderboard entries with points
    - Mark all records with `is_seed: true`
    - Implement idempotency check (skip if seed records exist)
    - Implement cleanup flag (SEED_CLEANUP=true removes seed data)
    - Support SEED_DATA=true env var for auto-seeding on first init
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10_

- [ ] 19. Mobile responsiveness and accessibility
  - [ ] 19.1 Implement responsive layouts and accessibility compliance
    - Ensure all layouts work from 320px to 2560px without horizontal overflow
    - Stack form fields in single-column on mobile (≥90% viewport width)
    - Minimum 16px font size for body text on mobile
    - Map occupies full width and ≥50% viewport height on mobile
    - Ensure WCAG AA contrast ratios (4.5:1 minimum)
    - Visible focus states (yellow glow ring) on all interactive elements
    - Alt text for map markers and cat images
    - Keyboard-navigable leaderboard and data tables
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major subsystems
- Property tests validate universal correctness properties defined in the design document using fast-check
- Unit tests validate specific examples and edge cases using Vitest
- The design uses TypeScript throughout — all implementation uses TypeScript with strict mode
- Temporal workflows require a separate worker process (`temporal/worker.ts`)
- Leaflet components must always use `next/dynamic` with `ssr: false`
- Supabase RLS policies are the primary security boundary — enforce at database level

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.5"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "4.1"] },
    { "id": 3, "tasks": ["2.1", "2.2", "4.2", "4.3"] },
    { "id": 4, "tasks": ["2.3", "2.4", "4.4", "4.5", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["6.5", "6.6", "6.7", "6.8", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4", "9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "9.4", "9.5", "10.1"] },
    { "id": 10, "tasks": ["10.2", "12.1"] },
    { "id": 11, "tasks": ["12.2", "12.3", "13.1"] },
    { "id": 12, "tasks": ["13.2", "13.3", "13.4", "13.5"] },
    { "id": 13, "tasks": ["13.6", "14.1"] },
    { "id": 14, "tasks": ["14.2", "14.3"] },
    { "id": 15, "tasks": ["14.4", "15.1"] },
    { "id": 16, "tasks": ["15.2", "15.3", "15.4", "16.1"] },
    { "id": 17, "tasks": ["16.2", "17.1", "17.2"] },
    { "id": 18, "tasks": ["18.1", "19.1"] }
  ]
}
```

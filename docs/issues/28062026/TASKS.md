# Implementation Task List

## BUGS

- [x] 1. Remove location asking when user registers → Skip location-consent redirect
- [x] 2. Informants online not updated → Add `last_active_at` tracking + update on API calls
- [x] 3. Allow user to input sighting time → Add datetime picker to SpottedAgentForm
- [x] 4. User cannot see current lost and found reports → Create a reports browsing page
- [x] 5. AI matching not triggered on report found → Fix fire-and-forget to use await

## IMPROVEMENTS

- [x] 6. Allow input address on map → Add geocoding/address search to MapPicker
- [x] 7. Real-time notifications for lost pet owners when a found report is submitted → Supabase Realtime subscription

## Summary of Changes

### Bug Fixes

1. **Registration location removal** — `app/(auth)/register/page.tsx`: Changed redirect from `/register/location-consent` to `/dashboard`. Location can still be set optionally via Settings.

2. **Informants online count** — `app/api/stats/route.ts`: Now updates `last_active_at` on the current user every time stats are fetched (every 30s), and queries `last_active_at >= 5min ago` using service role client. Added migration `00002` for the new column.

3. **Sighting time input** — `components/forms/SpottedAgentForm.tsx`: Added `datetime-local` input field. Updated `lib/validators.ts` to include optional `sighted_at` with validation. `app/api/agents/route.ts` now accepts user-provided `sighted_at` or falls back to `now()`.

4. **View all reports** — Created `app/(protected)/reports/page.tsx` with tabbed Lost/Found view. Added "Reports" link to both Sidebar and BottomNav navigation.

5. **AI matching fix** — `app/api/agents/route.ts`: Changed fire-and-forget `fetch().catch()` to `await fetch()` with try-catch, ensuring vision processing completes before the response closes on serverless.

### Improvements

6. **Address search on map** — `components/map/MapPicker.tsx`: Added OpenStreetMap Nominatim geocoding search bar above the map. Users can type an address and the map flies to it + drops a pin. Added `useMap` for fly-to animation.

7. **Real-time notifications** — Created `hooks/useRealtimeNotifications.ts` using Supabase Realtime postgres_changes subscription. Created `components/layout/NotificationBell.tsx` with unread badge + popup toast. Added to Sidebar. Migration `00003` enables realtime publication on `notifications` table.

### Database Migrations Required

Run these after deploying:
```bash
npx supabase db push
```

Or manually apply in SQL Editor:
- `supabase/migrations/00002_add_last_active_at_and_sighted_at.sql`
- `supabase/migrations/00003_enable_realtime_notifications.sql`

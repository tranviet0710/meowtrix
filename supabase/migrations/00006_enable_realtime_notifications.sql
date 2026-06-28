-- Enable Supabase Realtime for the notifications table.
-- This allows clients to subscribe to INSERT events for real-time alerts.
--
-- Idempotent: skips the ALTER when the table is already a member of the
-- publication, which is the case on remote projects where Realtime has been
-- toggled on via the Supabase dashboard before this migration is applied.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

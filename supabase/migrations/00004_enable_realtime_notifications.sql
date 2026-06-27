-- Enable Supabase Realtime for the notifications table
-- This allows clients to subscribe to INSERT events for real-time alerts
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

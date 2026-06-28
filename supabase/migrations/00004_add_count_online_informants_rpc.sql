-- RPC function to count online informants using database server time
-- This avoids clock skew between the application server and database server
CREATE OR REPLACE FUNCTION count_online_informants(minutes_ago integer DEFAULT 5)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM informants
  WHERE last_active_at >= (now() - (minutes_ago || ' minutes')::interval);
$$;

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Uses the anon key with cookie-based session management.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component where cookies
            // cannot be set. This is safe to ignore if middleware is
            // configured to refresh the session.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client with the service role key for server-side
 * operations that bypass Row Level Security. Use only in trusted server
 * contexts (API routes, background jobs) — never expose to the client.
 *
 * IMPORTANT: This uses the raw `@supabase/supabase-js` client (not the SSR
 * helper) and does NOT attach any user session cookies. If you create the
 * SSR-style client with the service role key while still passing cookies,
 * PostgREST resolves the role from the user's JWT in `Authorization` and
 * RLS will still apply — defeating the purpose of "service role". Avoid that.
 */
let cachedServiceRoleClient: SupabaseClient | null = null;

export async function createServiceRoleClient(): Promise<SupabaseClient> {
  if (cachedServiceRoleClient) {
    return cachedServiceRoleClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for service role client"
    );
  }

  cachedServiceRoleClient = createSupabaseClient(url, serviceKey, {
    auth: {
      // No session persistence — this client never represents a real user.
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedServiceRoleClient;
}

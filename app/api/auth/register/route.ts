import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseServer';
import { registrationSchema } from '@/lib/validators';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/register
 *
 * Registers a new Informant with email/password via Supabase Auth,
 * then creates a corresponding row in the `informants` table.
 *
 * Request body: { email, password, display_name }
 * Response: { success: true, user: { id, email } } or { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input using the registration schema
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? 'Invalid input';
      console.error('[Register] Validation failed:', JSON.stringify(parsed.error.errors, null, 2));
      console.error('[Register] Request body received:', JSON.stringify(body, null, 2));
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { email, password, display_name } = parsed.data;

    // Create Supabase Auth client for sign-up (uses anon key for auth operations)
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
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
              // Ignored in read-only contexts
            }
          },
        },
      }
    );

    // Sign up the user via Supabase Auth
    // Note: emailRedirectTo is omitted and we pass data options to skip
    // confirmation email where possible (reduces rate-limit risk on free tier)
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { display_name },
      },
    });

    if (authError) {
      console.error('[Register] Supabase Auth error:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
      });

      // Handle email rate limit exceeded
      if (
        authError.status === 429 ||
        authError.code === 'over_email_send_rate_limit' ||
        authError.message.toLowerCase().includes('rate limit')
      ) {
        return NextResponse.json(
          { success: false, error: 'Too many sign-up attempts. Please wait a few minutes and try again.' },
          { status: 429 }
        );
      }

      // Supabase returns a specific message when the email is already in use
      if (
        authError.message.toLowerCase().includes('already registered') ||
        authError.message.toLowerCase().includes('already been registered') ||
        authError.status === 422
      ) {
        return NextResponse.json(
          { success: false, error: 'Email already in use' },
          { status: 409 }
        );
      }

      // Return generic error message (don't reveal specifics per Req 1.6)
      return NextResponse.json(
        { success: false, error: 'Registration failed' },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: 'Registration failed' },
        { status: 500 }
      );
    }

    // Create the informant row using the service role client (bypasses RLS)
    const serviceClient = await createServiceRoleClient();
    const { error: insertError } = await serviceClient
      .from('informants')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        display_name,
        residential_area: '',
        residential_lat: null,
        residential_lng: null,
        location_consent: false,
        total_points: 0,
        successful_matches: 0,
        is_seed: false,
        last_active_at: new Date().toISOString(),
      });

    if (insertError) {
      // If we can't create the informant row, the registration is incomplete.
      // We still return the user since the auth account was created.
      // The informant row can be created again via the location consent step.
      console.error('Failed to create informant row:', insertError.message);
      return NextResponse.json(
        { success: false, error: 'Registration partially failed. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

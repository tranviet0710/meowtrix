import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseServer';
import { registrationSchema } from '@/lib/validators';
import { sendConfirmationEmail } from '@/lib/email';

/**
 * Minimum time (ms) for any registration attempt to prevent timing-based
 * account enumeration. This ensures that responses for new accounts and
 * existing accounts take approximately the same time.
 */
const MIN_REGISTER_DURATION_MS = 500;

/**
 * Sleep for the specified duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/auth/register
 *
 * Registers a new Informant with email/password using the Supabase Admin API
 * (`auth.admin.generateLink({ type: 'signup', ... })`). This:
 *   1. Creates the auth user in Supabase without sending Supabase's default
 *      confirmation email.
 *   2. Returns an `action_link` we deliver ourselves via Resend using the
 *      cat-themed template in `lib/email.ts`.
 *   3. Lets us insert the corresponding `informants` row synchronously.
 *
 * Request body: { email, password, display_name }
 * Response: { success: true, user: { id, email } } or { success: false, error }
 */
export async function POST(request: NextRequest) {
  // Record start time for timing normalization
  const startTime = Date.now();
  
  try {
    const body = await request.json();

    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
      console.error('[Register] Validation failed:', JSON.stringify(parsed.error.issues, null, 2));
      
      // Ensure minimum duration before returning to prevent timing attacks
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_REGISTER_DURATION_MS) {
        await sleep(MIN_REGISTER_DURATION_MS - elapsed);
      }
      
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { email, password, display_name } = parsed.data;

    // Service-role client bypasses RLS and grants admin auth access.
    const serviceClient = await createServiceRoleClient();

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
      'http://localhost:3000';
    const redirectTo = `${appUrl}/api/auth/callback?next=/dashboard`;

    // Create the user AND get back a signup confirmation action link.
    // admin.generateLink does not trigger Supabase's built-in mailer,
    // so we're free to send the Resend email ourselves below.
    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: { display_name },
          redirectTo,
        },
      });

    if (linkError || !linkData?.user) {
      console.error('[Register] generateLink error:', {
        message: linkError?.message,
        status: linkError?.status,
        code: linkError?.code,
      });

      const msg = (linkError?.message ?? '').toLowerCase();

      if (
        linkError?.status === 429 ||
        linkError?.code === 'over_email_send_rate_limit' ||
        msg.includes('rate limit')
      ) {
        // Ensure minimum duration before returning to prevent timing attacks
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_REGISTER_DURATION_MS) {
          await sleep(MIN_REGISTER_DURATION_MS - elapsed);
        }
        
        return NextResponse.json(
          { success: false, error: 'Too many sign-up attempts. Please wait a few minutes and try again.' },
          { status: 429 }
        );
      }

      if (
        msg.includes('already registered') ||
        msg.includes('already been registered') ||
        msg.includes('user already exists') ||
        linkError?.status === 422
      ) {
        // To prevent account enumeration, return the same success response
        // as if registration succeeded. The user will see "check your email"
        // but no email will be sent (or optionally, send a security notification).
        console.warn('[Register] Attempted registration with existing email:', email);
        
        // Ensure minimum duration before returning to prevent timing attacks
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_REGISTER_DURATION_MS) {
          await sleep(MIN_REGISTER_DURATION_MS - elapsed);
        }
        
        return NextResponse.json(
          {
            success: true,
            user: {
              id: 'enumeration-protection',
              email: email,
            },
          },
          { status: 201 }
        );
      }

      // Ensure minimum duration before returning to prevent timing attacks
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_REGISTER_DURATION_MS) {
        await sleep(MIN_REGISTER_DURATION_MS - elapsed);
      }

      return NextResponse.json(
        { success: false, error: 'Registration failed' },
        { status: 400 }
      );
    }

    const user = linkData.user;
    const actionLink = linkData.properties?.action_link;

    // Create the informant row. Duplicate-key errors mean the row already
    // exists (e.g. retry after partial failure) — treat as success.
    const { error: insertError } = await serviceClient
      .from('informants')
      .insert({
        id: user.id,
        email: user.email,
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

    if (insertError && insertError.code !== '23505') {
      console.error('[Register] Failed to create informant row:', insertError.message);
      
      // Ensure minimum duration before returning to prevent timing attacks
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_REGISTER_DURATION_MS) {
        await sleep(MIN_REGISTER_DURATION_MS - elapsed);
      }
      
      return NextResponse.json(
        { success: false, error: 'Registration partially failed. Please try again.' },
        { status: 500 }
      );
    }

    // Fire off the branded confirmation email. A delivery failure here
    // should not fail the registration — the user can resend from the UI.
    if (actionLink) {
      try {
        await sendConfirmationEmail({
          to: user.email!,
          displayName: display_name,
          actionLink,
          variant: 'signup',
        });
      } catch (mailErr) {
        console.error('[Register] sendConfirmationEmail failed:', mailErr);
      }
    } else {
      console.warn('[Register] No action_link returned from generateLink; skipping email send');
    }

    // Ensure minimum duration before returning to prevent timing attacks
    // This normalizes response time between new and existing accounts
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_REGISTER_DURATION_MS) {
      await sleep(MIN_REGISTER_DURATION_MS - elapsed);
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Register] Unexpected error:', error);
    
    // Ensure minimum duration before returning to prevent timing attacks
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_REGISTER_DURATION_MS) {
      await sleep(MIN_REGISTER_DURATION_MS - elapsed);
    }
    
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

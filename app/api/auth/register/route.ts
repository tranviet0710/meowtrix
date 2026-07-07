import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseServer';
import { registrationSchema } from '@/lib/validators';
import { sendConfirmationEmail } from '@/lib/email';

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
 * Response: { success: true, message: string } or { success: false, error: string }
 *
 * Security: To prevent account enumeration, all successful registration attempts
 * (including duplicate emails) return an identical response. Detailed outcomes
 * are logged server-side only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
      console.error('[Register] Validation failed:', JSON.stringify(parsed.error.issues, null, 2));
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
        // To prevent account enumeration, return an indistinguishable success response.
        // The user will see "check your email" but no email will be sent.
        // Detailed outcome is logged server-side only.
        console.warn('[Register] Attempted registration with existing email:', email);
        return NextResponse.json(
          {
            success: true,
            message: 'If your email can be registered, you will receive a confirmation link shortly.',
          },
          { status: 200 }
        );
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
        console.log('[Register] Confirmation email sent successfully to:', user.email);
      } catch (mailErr) {
        console.error('[Register] sendConfirmationEmail failed:', mailErr);
      }
    } else {
      console.warn('[Register] No action_link returned from generateLink; skipping email send');
    }

    // Return an indistinguishable response that matches the duplicate-email case.
    // This prevents account enumeration by making all successful registration
    // attempts look identical to the client.
    return NextResponse.json(
      {
        success: true,
        message: 'If your email can be registered, you will receive a confirmation link shortly.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Register] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

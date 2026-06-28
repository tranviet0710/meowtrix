// app/api/presence/route.ts — POST heartbeat to update last_active_at

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";

/**
 * POST /api/presence
 *
 * Lightweight endpoint that updates the user's `last_active_at` timestamp.
 * Called periodically by the client to maintain accurate "Informants Online" count.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const serviceClient = await createServiceRoleClient();
    await serviceClient
      .from("informants")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

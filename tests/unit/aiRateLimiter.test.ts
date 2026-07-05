// tests/unit/aiRateLimiter.test.ts — Unit tests for the AI extraction rate limiter.
//
// Validates the rolling-24h quota behaviour used by
// `POST /api/ai/extract-report` (Requirement 11.1). The Supabase client is
// stubbed with a minimal in-memory chain so the tests stay hermetic.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkExtractionQuota,
  recordSuccessfulExtraction,
} from "@/lib/aiRateLimiter";

// --- Mock chain builder -------------------------------------------------------

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
}

interface MockClientOptions {
  events?: Array<{ created_at: string }>;
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
}

function makeMockClient(opts: MockClientOptions = {}): {
  client: SupabaseClient;
  chain: MockChain;
  from: ReturnType<typeof vi.fn>;
} {
  const events = opts.events ?? [];
  // Build a chainable object where every non-terminal method returns the
  // same chain, and terminal methods return a Promise.
  const chain = {} as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({
    data: events,
    error: opts.selectError ?? null,
  });
  chain.insert = vi.fn().mockResolvedValue({
    error: opts.insertError ?? null,
  });

  const from = vi.fn().mockReturnValue(chain);
  const client = { from } as unknown as SupabaseClient;
  return { client, chain, from };
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

// --- checkExtractionQuota ----------------------------------------------------

describe("checkExtractionQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the first call when no events exist (remaining=5)", async () => {
    const { client } = makeMockClient();
    const result = await checkExtractionQuota(client, "user-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it("allows up to the 5th call in the window (allowed=true, remaining=1 at 4 events)", async () => {
    const now = Date.now();
    const events = Array.from({ length: 4 }, (_, i) => ({
      created_at: new Date(now - (5 - i) * 60_000).toISOString(),
    }));
    const { client } = makeMockClient({ events });

    const result = await checkExtractionQuota(client, "user-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks the 6th call in the window (allowed=false, remaining=0 at 5 events)", async () => {
    const now = Date.now();
    const events = Array.from({ length: 5 }, (_, i) => ({
      created_at: new Date(now - (6 - i) * 60_000).toISOString(),
    }));
    const { client } = makeMockClient({ events });

    const result = await checkExtractionQuota(client, "user-1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("computes resets_at from the oldest in-window event + 24h", async () => {
    const now = Date.now();
    // Oldest event 6 hours ago, in ascending order (as returned by the query).
    const oldestMs = now - 6 * 60 * 60 * 1000;
    const events = [
      { created_at: new Date(oldestMs).toISOString() },
      { created_at: new Date(oldestMs + 60 * 60 * 1000).toISOString() },
      { created_at: new Date(oldestMs + 2 * 60 * 60 * 1000).toISOString() },
    ];
    const { client } = makeMockClient({ events });

    const result = await checkExtractionQuota(client, "user-1");
    const expectedIso = new Date(oldestMs + WINDOW_MS).toISOString();
    expect(result.resets_at).toBe(expectedIso);
  });

  it("resets_at falls back to now+24h when no in-window events exist", async () => {
    const before = Date.now();
    const { client } = makeMockClient();

    const result = await checkExtractionQuota(client, "user-1");
    const after = Date.now();

    const resetsMs = new Date(result.resets_at).getTime();
    // Should be roughly `now + 24h`, with a small buffer for test overhead.
    expect(resetsMs).toBeGreaterThanOrEqual(before + WINDOW_MS - 1_000);
    expect(resetsMs).toBeLessThanOrEqual(after + WINDOW_MS + 1_000);
  });

  it("filters events older than 24h at the query level (uses .gt with a ~24h cutoff)", async () => {
    // The store filters rows > 24h old server-side. We verify the query itself
    // asks for `created_at > now() - 24h`.
    const before = Date.now();
    const { client, chain } = makeMockClient();
    await checkExtractionQuota(client, "user-1");
    const after = Date.now();

    expect(chain.gt).toHaveBeenCalledTimes(1);
    const [column, cutoff] = chain.gt.mock.calls[0];
    expect(column).toBe("created_at");
    const cutoffMs = new Date(cutoff as string).getTime();
    // Cutoff should be ~24h before "now" at call time.
    expect(cutoffMs).toBeGreaterThanOrEqual(before - WINDOW_MS - 1_000);
    expect(cutoffMs).toBeLessThanOrEqual(after - WINDOW_MS + 1_000);
  });

  it("filters the read to the caller's user_id", async () => {
    const { client, chain } = makeMockClient();
    await checkExtractionQuota(client, "user-abc");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-abc");
  });

  it("orders results ascending by created_at (oldest first)", async () => {
    const { client, chain } = makeMockClient();
    await checkExtractionQuota(client, "user-1");
    expect(chain.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });

  it("hits the ai_extraction_events table", async () => {
    const { client, from } = makeMockClient();
    await checkExtractionQuota(client, "user-1");
    expect(from).toHaveBeenCalledWith("ai_extraction_events");
  });

  it("throws when the database returns an error on select", async () => {
    const { client } = makeMockClient({
      selectError: { message: "connection refused" },
    });
    await expect(checkExtractionQuota(client, "user-1")).rejects.toThrow(
      /connection refused/
    );
  });
});

// --- recordSuccessfulExtraction ----------------------------------------------

describe("recordSuccessfulExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a single row containing just the user_id", async () => {
    const { client, chain, from } = makeMockClient();
    await recordSuccessfulExtraction(client, "user-42");

    expect(from).toHaveBeenCalledWith("ai_extraction_events");
    expect(chain.insert).toHaveBeenCalledTimes(1);
    expect(chain.insert).toHaveBeenCalledWith({ user_id: "user-42" });
  });

  it("throws when the insert returns an error", async () => {
    const { client } = makeMockClient({
      insertError: { message: "insert failed" },
    });
    await expect(recordSuccessfulExtraction(client, "user-1")).rejects.toThrow(
      /insert failed/
    );
  });
});

// tests/unit/leaderboard.test.ts — Unit tests for leaderboard API route

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

// The route now reads via the service-role client (to bypass RLS) but still
// uses the cookie-bound client only to authenticate the caller. Both factory
// functions are mocked; the same `mockFrom` is shared so existing call-tracking
// assertions keep working.
vi.mock("@/lib/supabaseServer", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

import { GET } from "@/app/api/leaderboard/route";
import { NextRequest } from "next/server";

function createRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/leaderboard");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

/** Standard entry shape returned by the SELECT in the leaderboard route. */
type DbEntry = {
  id: string;
  display_name: string;
  email: string | null;
  residential_area: string | null;
  location_consent: boolean;
  total_points: number;
  successful_matches: number;
  first_match_at: string | null;
};

function dbEntry(overrides: Partial<DbEntry> = {}): DbEntry {
  return {
    id: "u1",
    display_name: "Default",
    email: "default@example.com",
    residential_area: "Bangkok",
    location_consent: true,
    total_points: 10,
    successful_matches: 1,
    first_match_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Unauthorized" } });

    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns leaderboard with default pagination (page 1)", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const entries: DbEntry[] = [
      dbEntry({ id: "u1", display_name: "TopCat", email: "topcat@example.com", residential_area: "Silom", total_points: 50, successful_matches: 5 }),
      dbEntry({ id: "u2", display_name: "MidCat", email: "midcat@example.com", residential_area: "Chatuchak", total_points: 30, successful_matches: 3, first_match_at: "2024-01-05T00:00:00Z" }),
      dbEntry({ id: "u3", display_name: "NewCat", email: "newcat@example.com", residential_area: null, location_consent: false, total_points: 10, successful_matches: 1, first_match_at: "2024-01-10T00:00:00Z" }),
    ];

    // Mock count query: select → gt
    const mockCountGt = vi.fn().mockResolvedValue({ count: 3, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    // Mock data query: select → gt → order → order → range
    const mockRange = vi.fn().mockResolvedValue({ data: entries, error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.leaderboard).toHaveLength(3);
    expect(json.leaderboard[0]).toEqual({
      rank: 1,
      informant_id: "u1",
      display_name: "TopCat",
      total_points: 50,
      successful_matches: 5,
      first_match_at: "2024-01-01T00:00:00Z",
      residential_area: "Silom",
      email_masked: "t***t@example.com",
    });
    // Informant who opted out of location sharing should NOT expose their area.
    expect(json.leaderboard[2].residential_area).toBeNull();
    expect(json.leaderboard[1].rank).toBe(2);
    expect(json.leaderboard[2].rank).toBe(3);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.page_size).toBe(50);
    expect(json.pagination.total_entries).toBe(3);
    expect(json.pagination.total_pages).toBe(1);
    expect(json.pagination.has_next).toBe(false);
    expect(json.pagination.has_previous).toBe(false);
    expect(json.current_user_id).toBe("user-123");
  });

  it("calculates correct rank offset for page 2", async () => {
    const mockUser = { id: "user-456" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const entries = [
      dbEntry({ id: "u51", display_name: "PageTwoUser", email: "p51@example.com", residential_area: "Ari", total_points: 5, first_match_at: "2024-03-01T00:00:00Z" }),
    ];

    const mockCountGt = vi.fn().mockResolvedValue({ count: 51, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    const mockRange = vi.fn().mockResolvedValue({ data: entries, error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest({ page: "2" });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.leaderboard[0].rank).toBe(51);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.total_pages).toBe(2);
    expect(json.pagination.has_next).toBe(false);
    expect(json.pagination.has_previous).toBe(true);
    expect(mockRange).toHaveBeenCalledWith(50, 99);
  });

  it("returns empty leaderboard when no informants have points", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockCountGt = vi.fn().mockResolvedValue({ count: 0, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.leaderboard).toEqual([]);
    expect(json.pagination.total_entries).toBe(0);
    expect(json.pagination.total_pages).toBe(0);
  });

  it("clamps page to minimum 1 when invalid page is provided", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockCountGt = vi.fn().mockResolvedValue({ count: 0, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest({ page: "-5" });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(1);
    expect(mockRange).toHaveBeenCalledWith(0, 49);
  });

  it("handles non-numeric page parameter gracefully", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockCountGt = vi.fn().mockResolvedValue({ count: 0, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest({ page: "abc" });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(1);
  });

  it("returns 500 when count query fails", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockCountGt = vi.fn().mockResolvedValue({ count: null, error: { message: "DB error" } });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    mockFrom.mockImplementation(() => ({
      select: mockCountSelect,
    }));

    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to fetch leaderboard count");
  });

  it("returns 500 when data fetch fails", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockCountGt = vi.fn().mockResolvedValue({ count: 5, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    const mockRange = vi.fn().mockResolvedValue({ data: null, error: { message: "Query failed" } });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to fetch leaderboard");
  });

  it("sorts by total_points DESC then first_match_at ASC", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const entries = [
      dbEntry({ id: "early", display_name: "EarlyBird", email: "early@x.io", residential_area: "Silom", total_points: 20, successful_matches: 2, first_match_at: "2024-01-01T00:00:00Z" }),
      dbEntry({ id: "late", display_name: "LateComer", email: "late@x.io", residential_area: "Ari", total_points: 20, successful_matches: 2, first_match_at: "2024-06-01T00:00:00Z" }),
    ];

    const mockCountGt = vi.fn().mockResolvedValue({ count: 2, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    const mockRange = vi.fn().mockResolvedValue({ data: entries, error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockOrder1).toHaveBeenCalledWith("total_points", { ascending: false });
    expect(mockOrder2).toHaveBeenCalledWith("first_match_at", { ascending: true, nullsFirst: false });
    expect(json.leaderboard[0].display_name).toBe("EarlyBird");
    expect(json.leaderboard[0].rank).toBe(1);
    expect(json.leaderboard[1].display_name).toBe("LateComer");
    expect(json.leaderboard[1].rank).toBe(2);
  });

  it("only includes informants with total_points > 0", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockCountGt = vi.fn().mockResolvedValue({ count: 1, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });

    const mockRange = vi.fn().mockResolvedValue({
      data: [dbEntry({ id: "u1", display_name: "Active", total_points: 10 })],
      error: null,
    });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockDataSelect };
    });

    const request = createRequest();
    const response = await GET(request);
    await response.json();

    expect(response.status).toBe(200);
    expect(mockCountGt).toHaveBeenCalledWith("total_points", 0);
    expect(mockDataGt).toHaveBeenCalledWith("total_points", 0);
  });

  it("masks emails so the local-part is never fully exposed", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const entries = [
      dbEntry({ id: "u1", display_name: "Long", email: "alicia@example.com", total_points: 30 }),
      dbEntry({ id: "u2", display_name: "Short", email: "ab@x.io", total_points: 20 }),
      dbEntry({ id: "u3", display_name: "Solo", email: "b@x.io", total_points: 10 }),
    ];

    const mockCountGt = vi.fn().mockResolvedValue({ count: 3, error: null });
    const mockCountSelect = vi.fn().mockReturnValue({ gt: mockCountGt });
    const mockRange = vi.fn().mockResolvedValue({ data: entries, error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockDataGt = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockDataSelect = vi.fn().mockReturnValue({ gt: mockDataGt });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1
        ? { select: mockCountSelect }
        : { select: mockDataSelect };
    });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.leaderboard[0].email_masked).toBe("a***a@example.com");
    // Local-part length ≤ 2 → don't reveal both ends.
    expect(json.leaderboard[1].email_masked).toBe("a***@x.io");
    expect(json.leaderboard[2].email_masked).toBe("b***@x.io");
  });
});

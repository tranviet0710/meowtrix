// tests/unit/leaderboard.test.ts — Unit tests for leaderboard API route

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
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

    const entries = [
      { id: "u1", display_name: "TopCat", total_points: 50, successful_matches: 5, first_match_at: "2024-01-01T00:00:00Z" },
      { id: "u2", display_name: "MidCat", total_points: 30, successful_matches: 3, first_match_at: "2024-01-05T00:00:00Z" },
      { id: "u3", display_name: "NewCat", total_points: 10, successful_matches: 1, first_match_at: "2024-01-10T00:00:00Z" },
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
    });
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
      { id: "u51", display_name: "PageTwoUser", total_points: 5, successful_matches: 1, first_match_at: "2024-03-01T00:00:00Z" },
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
    expect(json.leaderboard[0].rank).toBe(51); // offset 50 + index 0 + 1
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.total_pages).toBe(2);
    expect(json.pagination.has_next).toBe(false);
    expect(json.pagination.has_previous).toBe(true);
    // Verify range was called with correct offset (page 2, pageSize 50 = offset 50-99)
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
    // Range should be 0-49 (page 1)
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

    // Two users with same points, different first_match_at — earliest should rank higher
    const entries = [
      { id: "early", display_name: "EarlyBird", total_points: 20, successful_matches: 2, first_match_at: "2024-01-01T00:00:00Z" },
      { id: "late", display_name: "LateComer", total_points: 20, successful_matches: 2, first_match_at: "2024-06-01T00:00:00Z" },
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
    // Verify order calls: first by total_points DESC, then by first_match_at ASC
    expect(mockOrder1).toHaveBeenCalledWith("total_points", { ascending: false });
    expect(mockOrder2).toHaveBeenCalledWith("first_match_at", { ascending: true, nullsFirst: false });
    // EarlyBird should be rank 1, LateComer rank 2
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

    const mockRange = vi.fn().mockResolvedValue({ data: [{ id: "u1", display_name: "Active", total_points: 10, successful_matches: 1, first_match_at: "2024-01-01T00:00:00Z" }], error: null });
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
    // Verify gt filter was applied
    expect(mockCountGt).toHaveBeenCalledWith("total_points", 0);
    expect(mockDataGt).toHaveBeenCalledWith("total_points", 0);
  });
});

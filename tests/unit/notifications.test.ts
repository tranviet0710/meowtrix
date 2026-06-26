// tests/unit/notifications.test.ts — Unit tests for notification API route

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

import { GET, PATCH } from "@/app/api/notifications/route";
import { NextRequest } from "next/server";

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/notifications");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Unauthorized" } });

    const request = createGetRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns notifications with default pagination", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const notifications = [
      { id: "n1", recipient_id: "user-123", type: "match_alert", title: "New Match", body: "A match was found", metadata: {}, read: false, created_at: "2024-01-02T00:00:00Z" },
      { id: "n2", recipient_id: "user-123", type: "escalation", title: "Alert", body: "Nearby cat missing", metadata: {}, read: true, created_at: "2024-01-01T00:00:00Z" },
    ];

    // Mock the main notifications query
    const mockRange = vi.fn().mockResolvedValue({ data: notifications, error: null, count: 2 });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqRecipient = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelectMain = vi.fn().mockReturnValue({ eq: mockEqRecipient });

    // Mock the unread count query
    const mockEqReadFalse = vi.fn().mockResolvedValue({ count: 1, error: null });
    const mockEqRecipientUnread = vi.fn().mockReturnValue({ eq: mockEqReadFalse });
    const mockSelectUnread = vi.fn().mockReturnValue({ eq: mockEqRecipientUnread });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectMain };
      }
      return { select: mockSelectUnread };
    });

    const request = createGetRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications).toHaveLength(2);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(20);
    expect(json.pagination.total).toBe(2);
    expect(json.unread_count).toBe(1);
  });

  it("filters to unread_only when parameter is true", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const unreadNotifications = [
      { id: "n1", recipient_id: "user-123", type: "match_alert", title: "New Match", body: "A match was found", metadata: {}, read: false, created_at: "2024-01-02T00:00:00Z" },
    ];

    // Chain: select → eq(recipient_id) → eq(read, false) → order → range
    const mockRange = vi.fn().mockResolvedValue({ data: unreadNotifications, error: null, count: 1 });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqRead = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEqRecipient = vi.fn().mockReturnValue({ eq: mockEqRead });
    const mockSelectMain = vi.fn().mockReturnValue({ eq: mockEqRecipient });

    // Mock unread count query
    const mockEqReadFalse = vi.fn().mockResolvedValue({ count: 1, error: null });
    const mockEqRecipientUnread = vi.fn().mockReturnValue({ eq: mockEqReadFalse });
    const mockSelectUnread = vi.fn().mockReturnValue({ eq: mockEqRecipientUnread });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectMain };
      }
      return { select: mockSelectUnread };
    });

    const request = createGetRequest({ unread_only: "true" });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].read).toBe(false);
    // Verify eq was called with read filter
    expect(mockEqRead).toHaveBeenCalledWith("read", false);
  });

  it("respects page and limit parameters", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null, count: 50 });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqRecipient = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelectMain = vi.fn().mockReturnValue({ eq: mockEqRecipient });

    const mockEqReadFalse = vi.fn().mockResolvedValue({ count: 5, error: null });
    const mockEqRecipientUnread = vi.fn().mockReturnValue({ eq: mockEqReadFalse });
    const mockSelectUnread = vi.fn().mockReturnValue({ eq: mockEqRecipientUnread });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectMain };
      }
      return { select: mockSelectUnread };
    });

    const request = createGetRequest({ page: "3", limit: "10" });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(3);
    expect(json.pagination.limit).toBe(10);
    expect(json.pagination.total).toBe(50);
    expect(json.pagination.total_pages).toBe(5);
    // Verify range was called with correct offset (page 3, limit 10 = offset 20-29)
    expect(mockRange).toHaveBeenCalledWith(20, 29);
  });

  it("clamps limit to max 100", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqRecipient = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelectMain = vi.fn().mockReturnValue({ eq: mockEqRecipient });

    const mockEqReadFalse = vi.fn().mockResolvedValue({ count: 0, error: null });
    const mockEqRecipientUnread = vi.fn().mockReturnValue({ eq: mockEqReadFalse });
    const mockSelectUnread = vi.fn().mockReturnValue({ eq: mockEqRecipientUnread });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectMain };
      }
      return { select: mockSelectUnread };
    });

    const request = createGetRequest({ limit: "500" });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.limit).toBe(100);
  });

  it("returns 500 on database error", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockRange = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" }, count: null });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqRecipient = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelectMain = vi.fn().mockReturnValue({ eq: mockEqRecipient });

    mockFrom.mockImplementation(() => ({ select: mockSelectMain }));

    const request = createGetRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to fetch notifications");
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Unauthorized" } });

    const request = createPatchRequest({ ids: ["abc-123"] });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when ids array is empty", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const request = createPatchRequest({ ids: [] });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
  });

  it("returns 400 when ids contains non-UUID strings", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const request = createPatchRequest({ ids: ["not-a-uuid"] });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
  });

  it("returns 400 when body is missing ids field", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const request = createPatchRequest({});
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
  });

  it("marks notifications as read and returns updated ids", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const notificationIds = [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ];

    const mockSelectResult = vi.fn().mockResolvedValue({
      data: notificationIds.map((id) => ({ id })),
      error: null,
    });
    const mockEqRecipient = vi.fn().mockReturnValue({ select: mockSelectResult });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEqRecipient });
    const mockUpdateFn = vi.fn().mockReturnValue({ in: mockIn });

    mockFrom.mockImplementation(() => ({ update: mockUpdateFn }));

    const request = createPatchRequest({ ids: notificationIds });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.updated).toEqual(notificationIds);
    expect(json.count).toBe(2);
    expect(mockUpdateFn).toHaveBeenCalledWith({ read: true });
  });

  it("returns 500 on database update error", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const notificationIds = ["550e8400-e29b-41d4-a716-446655440001"];

    const mockSelectResult = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Update failed" },
    });
    const mockEqRecipient = vi.fn().mockReturnValue({ select: mockSelectResult });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEqRecipient });
    const mockUpdateFn = vi.fn().mockReturnValue({ in: mockIn });

    mockFrom.mockImplementation(() => ({ update: mockUpdateFn }));

    const request = createPatchRequest({ ids: notificationIds });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to mark notifications as read");
  });

  it("returns 400 when more than 100 ids provided", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const tooManyIds = Array.from({ length: 101 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    );

    const request = createPatchRequest({ ids: tooManyIds });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
  });
});

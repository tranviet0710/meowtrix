// tests/unit/overlordsApiErrorHandling.test.ts — Tests for error sanitization in overlords API

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/overlords/route";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Mock other dependencies
vi.mock("@/lib/gemini", () => ({
  extractTraitsFromImage: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/matchTrigger", () => ({
  triggerMatchEvaluation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/geocoding", () => ({
  reverseGeocode: vi.fn().mockResolvedValue("Test Address"),
}));

vi.mock("@temporalio/client", () => ({
  Connection: {
    connect: vi.fn().mockResolvedValue({
      close: vi.fn(),
    }),
  },
  Client: vi.fn().mockImplementation(() => ({
    workflow: {
      start: vi.fn().mockResolvedValue({ workflowId: "test-workflow" }),
    },
  })),
}));

vi.mock("@/lib/temporalClient", () => ({
  getClientConnectionOptions: vi.fn().mockReturnValue({}),
  getWorkflowOptions: vi.fn().mockReturnValue({}),
  getTemporalTaskQueue: vi.fn().mockReturnValue("test-queue"),
  getTemporalNamespace: vi.fn().mockReturnValue("default"),
  isTemporalConfigured: vi.fn().mockReturnValue(true),
}));

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/overlords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/overlords - Error Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes database errors without exposing schema details", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Simulate a database type mismatch error
    const dbError = {
      message: 'column "photos" is of type text[] but expression is of type jsonb',
      details: "You will need to rewrite or cast the expression.",
      hint: null,
      code: "42804",
    };

    mockSingle.mockResolvedValue({ data: null, error: dbError });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "cat",
      pet_name: "Fluffy",
      description: "Orange tabby",
      last_seen_lat: 13.75,
      last_seen_lng: 100.5,
      last_seen_at: new Date().toISOString(),
      photos: ["https://example.com/photo.jpg"],
      verification_name: "Spot",
      verification_marking: "White paw",
      verification_trait: "Loves tuna",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    
    // Should return sanitized error message
    expect(json.error).toBe("Failed to create Overlord");
    
    // Should NOT expose database schema details
    expect(json.error).not.toContain("photos");
    expect(json.error).not.toContain("text[]");
    expect(json.error).not.toContain("jsonb");
    expect(json.error).not.toContain("column");
    expect(json.error).not.toContain("42804");
  });

  it("sanitizes constraint violation errors", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const dbError = {
      message: 'null value in column "owner_id" violates not-null constraint',
      details: 'Failing row contains (null, ...).',
      hint: null,
      code: "23502",
    };

    mockSingle.mockResolvedValue({ data: null, error: dbError });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "dog",
      pet_name: "Rex",
      description: "Golden retriever",
      last_seen_lat: 13.75,
      last_seen_lng: 100.5,
      last_seen_at: new Date().toISOString(),
      photos: ["https://example.com/photo.jpg"],
      verification_name: "Collar",
      verification_marking: "Red collar",
      verification_trait: "Friendly",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create Overlord");
    
    // Should NOT expose constraint details
    expect(json.error).not.toContain("owner_id");
    expect(json.error).not.toContain("not-null");
    expect(json.error).not.toContain("constraint");
    expect(json.error).not.toContain("23502");
  });

  it("sanitizes check constraint errors without exposing constraint names", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const dbError = {
      message: 'new row for relation "overlords" violates check constraint "overlords_verification_check"',
      details: 'Failing row contains (...).',
      hint: null,
      code: "23514",
    };

    mockSingle.mockResolvedValue({ data: null, error: dbError });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "cat",
      pet_name: "Whiskers",
      description: "Siamese cat",
      last_seen_lat: 13.75,
      last_seen_lng: 100.5,
      last_seen_at: new Date().toISOString(),
      photos: ["https://example.com/photo.jpg"],
      verification_name: "Chip",
      verification_marking: "Microchip",
      verification_trait: "Blue eyes",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create Overlord");
    
    // Should NOT expose check constraint names
    expect(json.error).not.toContain("overlords_verification_check");
    expect(json.error).not.toContain("check constraint");
    expect(json.error).not.toContain("overlords");
    expect(json.error).not.toContain("23514");
  });

  it("returns validation error for invalid input without database interaction", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const request = createPostRequest({
      pet_type: "invalid_type",
      pet_name: "Test",
      description: "Test",
      last_seen_lat: 13.75,
      last_seen_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    
    // Database should not be called for validation errors
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// tests/unit/agentsApiErrorHandling.test.ts — Tests for error sanitization in agents API

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/agents/route";
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

// Mock other dependencies to prevent side effects
vi.mock("@/lib/gemini", () => ({
  extractTraitsFromImage: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/matchTrigger", () => ({
  triggerMatchEvaluation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/geocoding", () => ({
  reverseGeocode: vi.fn().mockResolvedValue("Test Address"),
}));

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agents - Error Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Unauthorized" } });

    const request = createPostRequest({
      pet_type: "cat",
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("sanitizes database constraint violation errors", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Simulate a database constraint violation
    const dbError = {
      message: 'duplicate key value violates unique constraint "agents_pkey"',
      details: "Key (id)=(123) already exists.",
      hint: "Check your insert statement",
      code: "23505",
    };

    mockSingle.mockResolvedValue({ data: null, error: dbError });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "cat",
      description: "Test agent",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    
    // Should return sanitized error message
    expect(json.error).toBe("Failed to create Agent");
    
    // Should NOT expose database details
    expect(json.error).not.toContain("duplicate key");
    expect(json.error).not.toContain("constraint");
    expect(json.error).not.toContain("agents_pkey");
    expect(json.error).not.toContain("23505");
    expect(json.error).not.toContain(dbError.message);
  });

  it("sanitizes type mismatch errors without exposing column types", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Simulate the pentest scenario: photos field type mismatch
    const dbError = {
      message: 'column "photos" is of type text[] but expression is of type integer',
      details: "You will need to rewrite or cast the expression.",
      hint: null,
      code: "42804",
    };

    mockSingle.mockResolvedValue({ data: null, error: dbError });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "dog",
      description: "Spotted near park",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    
    // Should return sanitized error message
    expect(json.error).toBe("Failed to create Agent");
    
    // Should NOT expose schema details
    expect(json.error).not.toContain("photos");
    expect(json.error).not.toContain("text[]");
    expect(json.error).not.toContain("integer");
    expect(json.error).not.toContain("column");
    expect(json.error).not.toContain("42804");
  });

  it("sanitizes foreign key violation errors without exposing table relationships", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const dbError = {
      message: 'insert or update on table "agents" violates foreign key constraint "agents_reporter_id_fkey"',
      details: 'Key (reporter_id)=(invalid-uuid) is not present in table "users".',
      hint: null,
      code: "23503",
    };

    mockSingle.mockResolvedValue({ data: null, error: dbError });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "cat",
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create Agent");
    
    // Should NOT expose foreign key details
    expect(json.error).not.toContain("agents_reporter_id_fkey");
    expect(json.error).not.toContain("foreign key");
    expect(json.error).not.toContain("users");
    expect(json.error).not.toContain("reporter_id");
  });

  it("sanitizes RLS policy violation errors", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const dbError = {
      message: 'new row violates row-level security policy for table "agents"',
      details: null,
      hint: null,
      code: "42501",
    };

    mockSingle.mockResolvedValue({ data: null, error: dbError });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "cat",
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create Agent");
    
    // Should NOT expose RLS policy details
    expect(json.error).not.toContain("row-level security");
    expect(json.error).not.toContain("policy");
    expect(json.error).not.toContain("42501");
  });

  it("sanitizes check constraint violation errors", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const dbError = {
      message: 'new row for relation "agents" violates check constraint "agents_photos_check"',
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
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create Agent");
    
    // Should NOT expose check constraint names
    expect(json.error).not.toContain("agents_photos_check");
    expect(json.error).not.toContain("check constraint");
    expect(json.error).not.toContain("23514");
  });

  it("validates photos field before database insert", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Test missing photos
    const request1 = createPostRequest({
      pet_type: "cat",
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: [],
    });

    const response1 = await POST(request1);
    const json1 = await response1.json();

    expect(response1.status).toBe(400);
    expect(json1.error).toBe("At least 1 photo URL is required");

    // Test too many photos
    const request2 = createPostRequest({
      pet_type: "cat",
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["url1", "url2", "url3", "url4", "url5", "url6"],
    });

    const response2 = await POST(request2);
    const json2 = await response2.json();

    expect(response2.status).toBe(400);
    expect(json2.error).toBe("Maximum 5 photos allowed");
  });

  it("returns validation error for invalid schema fields", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const request = createPostRequest({
      pet_type: "invalid_type",
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(json.details).toBeDefined();
  });

  it("handles null error gracefully", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Simulate insert returning no data and no error (edge case)
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const request = createPostRequest({
      pet_type: "cat",
      description: "Test",
      sighting_lat: 13.75,
      sighting_lng: 100.5,
      photos: ["https://example.com/photo.jpg"],
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create Agent");
  });
});

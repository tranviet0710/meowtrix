// tests/unit/visionProcess.test.ts — Unit tests for vision processing API route authorization and ownership checks

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock functions for Supabase clients
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockServiceFrom = vi.fn();

// Mock the Supabase server module
vi.mock("@/lib/supabaseServer", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: mockServiceFrom,
  })),
}));

// Mock the Gemini extraction function
vi.mock("@/lib/gemini", () => ({
  extractTraitsFromImage: vi.fn(),
}));

// Mock the match evaluation trigger
vi.mock("@/lib/matchTrigger", () => ({
  triggerMatchEvaluation: vi.fn(),
}));

import { POST } from "@/app/api/vision/process/route";
import { NextRequest } from "next/server";
import { extractTraitsFromImage } from "@/lib/gemini";
import { triggerMatchEvaluation } from "@/lib/matchTrigger";

// Get the mocked functions
const mockExtractTraitsFromImage = vi.mocked(extractTraitsFromImage);
const mockTriggerMatchEvaluation = vi.mocked(triggerMatchEvaluation);

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/vision/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/vision/process - Authorization Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ 
      data: { user: null }, 
      error: { message: "Unauthorized" } 
    });

    const request = createRequest({
      record_id: "overlord-123",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    
    // Verify no database operations were attempted
    expect(mockServiceFrom).not.toHaveBeenCalled();
    expect(mockExtractTraitsFromImage).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated user tries to process another user's overlord record", async () => {
    const attackerUser = { id: "attacker-user-id" };
    const victimUserId = "victim-user-id";

    mockGetUser.mockResolvedValue({ 
      data: { user: attackerUser }, 
      error: null 
    });

    // Mock the ownership check - record belongs to victim
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: "overlord-123", owner_id: victimUserId },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockServiceFrom.mockReturnValue({ select: mockSelect });

    const request = createRequest({
      record_id: "overlord-123",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Forbidden - you can only process your own records");
    
    // Verify ownership was checked
    expect(mockServiceFrom).toHaveBeenCalledWith("overlords");
    expect(mockSelect).toHaveBeenCalledWith("id, owner_id");
    expect(mockEq).toHaveBeenCalledWith("id", "overlord-123");
    
    // Verify no processing occurred
    expect(mockExtractTraitsFromImage).not.toHaveBeenCalled();
    expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated user tries to process another user's agent record", async () => {
    const attackerUser = { id: "attacker-user-id" };
    const victimUserId = "victim-user-id";

    mockGetUser.mockResolvedValue({ 
      data: { user: attackerUser }, 
      error: null 
    });

    // Mock the ownership check - record belongs to victim
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: "agent-456", reporter_id: victimUserId },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockServiceFrom.mockReturnValue({ select: mockSelect });

    const request = createRequest({
      record_id: "agent-456",
      record_type: "agent",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Forbidden - you can only process your own records");
    
    // Verify ownership was checked with correct field for agents
    expect(mockServiceFrom).toHaveBeenCalledWith("agents");
    expect(mockSelect).toHaveBeenCalledWith("id, reporter_id");
    expect(mockEq).toHaveBeenCalledWith("id", "agent-456");
    
    // Verify no processing occurred
    expect(mockExtractTraitsFromImage).not.toHaveBeenCalled();
    expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
  });

  it("returns 404 when record does not exist", async () => {
    const user = { id: "user-123" };

    mockGetUser.mockResolvedValue({ 
      data: { user }, 
      error: null 
    });

    // Mock record not found
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockServiceFrom.mockReturnValue({ select: mockSelect });

    const request = createRequest({
      record_id: "nonexistent-id",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Record not found");
    
    // Verify no processing occurred
    expect(mockExtractTraitsFromImage).not.toHaveBeenCalled();
  });

  it("successfully processes record when user owns the overlord", async () => {
    const user = { id: "user-123" };

    mockGetUser.mockResolvedValue({ 
      data: { user }, 
      error: null 
    });

    // Mock ownership check - user owns the record
    const mockSingleOwnership = vi.fn().mockResolvedValue({
      data: { id: "overlord-123", owner_id: user.id },
      error: null,
    });
    const mockEqOwnership = vi.fn().mockReturnValue({ single: mockSingleOwnership });
    const mockSelectOwnership = vi.fn().mockReturnValue({ eq: mockEqOwnership });

    // Mock the update operation
    const mockUpdate = vi.fn().mockResolvedValue({ error: null });
    const mockEqUpdate = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockUpdateChain = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: ownership check
        return { select: mockSelectOwnership };
      }
      // Second call: update
      return { update: mockUpdateChain };
    });

    // Mock successful trait extraction
    mockExtractTraitsFromImage.mockResolvedValue({
      primary_color: "orange",
      secondary_color: "white",
      pattern_type: "tabby",
      fur_length: "short",
      breed_estimate: "Domestic Shorthair",
      distinguishing_features: ["striped tail"],
    });

    mockTriggerMatchEvaluation.mockResolvedValue(undefined);

    const request = createRequest({
      record_id: "overlord-123",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.record_id).toBe("overlord-123");
    expect(json.tagging_status).toBe("complete");
    expect(json.trait_tags).toBeDefined();
    
    // Verify ownership was checked first
    expect(mockSelectOwnership).toHaveBeenCalledWith("id, owner_id");
    
    // Verify processing occurred
    expect(mockExtractTraitsFromImage).toHaveBeenCalledWith("https://example.com/cat.jpg");
    expect(mockTriggerMatchEvaluation).toHaveBeenCalledWith(
      expect.anything(),
      "overlord-123",
      "overlord"
    );
  });

  it("successfully processes record when user is the reporter of the agent", async () => {
    const user = { id: "user-456" };

    mockGetUser.mockResolvedValue({ 
      data: { user }, 
      error: null 
    });

    // Mock ownership check - user is the reporter
    const mockSingleOwnership = vi.fn().mockResolvedValue({
      data: { id: "agent-789", reporter_id: user.id },
      error: null,
    });
    const mockEqOwnership = vi.fn().mockReturnValue({ single: mockSingleOwnership });
    const mockSelectOwnership = vi.fn().mockReturnValue({ eq: mockEqOwnership });

    // Mock the update operation
    const mockUpdate = vi.fn().mockResolvedValue({ error: null });
    const mockEqUpdate = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockUpdateChain = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectOwnership };
      }
      return { update: mockUpdateChain };
    });

    // Mock successful trait extraction
    mockExtractTraitsFromImage.mockResolvedValue({
      primary_color: "black",
      secondary_color: null,
      pattern_type: "solid",
      fur_length: "long",
      breed_estimate: "Persian",
      distinguishing_features: ["fluffy"],
    });

    mockTriggerMatchEvaluation.mockResolvedValue(undefined);

    const request = createRequest({
      record_id: "agent-789",
      record_type: "agent",
      photo_url: "https://example.com/spotted-cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.record_id).toBe("agent-789");
    expect(json.tagging_status).toBe("complete");
    
    // Verify ownership was checked with reporter_id for agents
    expect(mockSelectOwnership).toHaveBeenCalledWith("id, reporter_id");
  });

  it("prevents cross-user match evaluation trigger exploitation", async () => {
    const attackerUser = { id: "attacker-id" };
    const victimUserId = "victim-id";

    mockGetUser.mockResolvedValue({ 
      data: { user: attackerUser }, 
      error: null 
    });

    // Attacker tries to trigger match evaluation on victim's record
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: "overlord-victim", owner_id: victimUserId },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockServiceFrom.mockReturnValue({ select: mockSelect });

    const request = createRequest({
      record_id: "overlord-victim",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Forbidden - you can only process your own records");
    
    // Critical: match evaluation should never be triggered for unauthorized records
    expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
  });

  it("validates required fields before authentication", async () => {
    const request = createRequest({
      record_id: "overlord-123",
      record_type: "overlord",
      // Missing photo_url
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required fields");
    
    // Should not even attempt authentication
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("validates record_type is either overlord or agent", async () => {
    const request = createRequest({
      record_id: "some-id",
      record_type: "invalid-type",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("record_type must be 'overlord' or 'agent'");
    
    // Should not attempt authentication for invalid input
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("handles incomplete trait extraction without triggering match evaluation", async () => {
    const user = { id: "user-123" };

    mockGetUser.mockResolvedValue({ 
      data: { user }, 
      error: null 
    });

    // Mock ownership check
    const mockSingleOwnership = vi.fn().mockResolvedValue({
      data: { id: "overlord-123", owner_id: user.id },
      error: null,
    });
    const mockEqOwnership = vi.fn().mockReturnValue({ single: mockSingleOwnership });
    const mockSelectOwnership = vi.fn().mockReturnValue({ eq: mockEqOwnership });

    // Mock the update operation
    const mockUpdate = vi.fn().mockResolvedValue({ error: null });
    const mockEqUpdate = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockUpdateChain = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectOwnership };
      }
      return { update: mockUpdateChain };
    });

    // Mock incomplete extraction (returns null)
    mockExtractTraitsFromImage.mockResolvedValue(null);

    const request = createRequest({
      record_id: "overlord-123",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tagging_status).toBe("incomplete");
    expect(json.trait_tags).toBeNull();
    
    // Match evaluation should NOT be triggered for incomplete tagging
    expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
  });

  it("handles trait extraction failure and marks for manual review", async () => {
    const user = { id: "user-123" };

    mockGetUser.mockResolvedValue({ 
      data: { user }, 
      error: null 
    });

    // Mock ownership check
    const mockSingleOwnership = vi.fn().mockResolvedValue({
      data: { id: "overlord-123", owner_id: user.id },
      error: null,
    });
    const mockEqOwnership = vi.fn().mockReturnValue({ single: mockSingleOwnership });
    const mockSelectOwnership = vi.fn().mockReturnValue({ eq: mockEqOwnership });

    // Mock the update operation
    const mockUpdate = vi.fn().mockResolvedValue({ error: null });
    const mockEqUpdate = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockUpdateChain = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectOwnership };
      }
      return { update: mockUpdateChain };
    });

    // Mock extraction failure
    mockExtractTraitsFromImage.mockRejectedValue(new Error("API error"));

    const request = createRequest({
      record_id: "overlord-123",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tagging_status).toBe("manual_review");
    expect(json.trait_tags).toBeNull();
    
    // Match evaluation should NOT be triggered for failed extraction
    expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
  });

  it("continues successfully even if match evaluation fails", async () => {
    const user = { id: "user-123" };

    mockGetUser.mockResolvedValue({ 
      data: { user }, 
      error: null 
    });

    // Mock ownership check
    const mockSingleOwnership = vi.fn().mockResolvedValue({
      data: { id: "overlord-123", owner_id: user.id },
      error: null,
    });
    const mockEqOwnership = vi.fn().mockReturnValue({ single: mockSingleOwnership });
    const mockSelectOwnership = vi.fn().mockReturnValue({ eq: mockEqOwnership });

    // Mock the update operation
    const mockUpdate = vi.fn().mockResolvedValue({ error: null });
    const mockEqUpdate = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockUpdateChain = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelectOwnership };
      }
      return { update: mockUpdateChain };
    });

    // Mock successful extraction
    mockExtractTraitsFromImage.mockResolvedValue({
      primary_color: "gray",
      secondary_color: null,
      pattern_type: "solid",
      fur_length: "short",
      breed_estimate: "Russian Blue",
      distinguishing_features: ["blue eyes"],
    });

    // Mock match evaluation failure
    mockTriggerMatchEvaluation.mockRejectedValue(new Error("Match evaluation failed"));

    const request = createRequest({
      record_id: "overlord-123",
      record_type: "overlord",
      photo_url: "https://example.com/cat.jpg",
    });

    const response = await POST(request);
    const json = await response.json();

    // Should still return success even if match evaluation fails
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.tagging_status).toBe("complete");
  });
});

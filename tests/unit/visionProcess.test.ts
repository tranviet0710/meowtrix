// tests/unit/visionProcess.test.ts — Unit tests for vision processing API route
// Tests verify the authorization bypass vulnerability is mitigated

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies - must be defined before vi.mock calls
vi.mock("@/lib/supabaseServer", () => {
  const mockGetUser = vi.fn();
  const mockAuthSelect = vi.fn();
  const mockAuthFrom = vi.fn();
  const mockServiceFrom = vi.fn();
  
  return {
    createClient: vi.fn(async () => ({
      auth: {
        getUser: mockGetUser,
      },
      from: mockAuthFrom,
    })),
    createServiceRoleClient: vi.fn(async () => ({
      from: mockServiceFrom,
    })),
  };
});

vi.mock("@/lib/gemini", () => ({
  extractTraitsFromImage: vi.fn(),
}));

vi.mock("@/lib/matchTrigger", () => ({
  triggerMatchEvaluation: vi.fn(),
}));

import { POST } from "@/app/api/vision/process/route";
import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabaseServer";
import { extractTraitsFromImage } from "@/lib/gemini";
import { triggerMatchEvaluation } from "@/lib/matchTrigger";

// Get mocked functions
const mockCreateClient = vi.mocked(createClient);
const mockCreateServiceRoleClient = vi.mocked(createServiceRoleClient);
const mockExtractTraitsFromImage = vi.mocked(extractTraitsFromImage);
const mockTriggerMatchEvaluation = vi.mocked(triggerMatchEvaluation);

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/vision/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/vision/process - Authorization Security", () => {
  let mockGetUser: ReturnType<typeof vi.fn>;
  let mockAuthFrom: ReturnType<typeof vi.fn>;
  let mockAuthSelect: ReturnType<typeof vi.fn>;
  let mockServiceFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup fresh mock functions for each test
    mockGetUser = vi.fn();
    mockAuthFrom = vi.fn();
    mockAuthSelect = vi.fn();
    mockServiceFrom = vi.fn();
    
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: mockGetUser,
      },
      from: mockAuthFrom,
    } as any);
    
    mockCreateServiceRoleClient.mockResolvedValue({
      from: mockServiceFrom,
    } as any);
  });

  describe("Authentication checks", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ 
        data: { user: null }, 
        error: { message: "Unauthorized" } 
      });

      const request = createPostRequest({
        record_id: "overlord-123",
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
      
      // Verify no database operations were attempted
      expect(mockAuthFrom).not.toHaveBeenCalled();
      expect(mockServiceFrom).not.toHaveBeenCalled();
    });

    it("returns 401 when auth error occurs", async () => {
      mockGetUser.mockResolvedValue({ 
        data: { user: null }, 
        error: new Error("Auth service unavailable") 
      });

      const request = createPostRequest({
        record_id: "agent-456",
        record_type: "agent",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Ownership verification - Cross-user authorization bypass prevention", () => {
    it("returns 403 when authenticated user tries to process another user's overlord record", async () => {
      const attackerUserId = "attacker-user-id";
      const victimUserId = "victim-user-id";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: attackerUserId } }, 
        error: null 
      });

      // Mock the ownership check - record belongs to victim
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "overlord-123", owner_id: victimUserId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const request = createPostRequest({
        record_id: "overlord-123",
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe("Forbidden — you can only process your own records");
      
      // Verify ownership check was performed with correct field
      expect(mockAuthFrom).toHaveBeenCalledWith("overlords");
      expect(mockAuthSelect).toHaveBeenCalledWith("id, owner_id");
      expect(mockEq).toHaveBeenCalledWith("id", "overlord-123");
      
      // Verify service role client was never used for updates
      expect(mockServiceFrom).not.toHaveBeenCalled();
      expect(mockExtractTraitsFromImage).not.toHaveBeenCalled();
      expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
    });

    it("returns 403 when authenticated user tries to process another user's agent record", async () => {
      const attackerUserId = "attacker-user-id";
      const victimUserId = "victim-user-id";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: attackerUserId } }, 
        error: null 
      });

      // Mock the ownership check - record belongs to victim
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "agent-456", reporter_id: victimUserId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const request = createPostRequest({
        record_id: "agent-456",
        record_type: "agent",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe("Forbidden — you can only process your own records");
      
      // Verify ownership check was performed with correct field for agents
      expect(mockAuthFrom).toHaveBeenCalledWith("agents");
      expect(mockAuthSelect).toHaveBeenCalledWith("id, reporter_id");
      expect(mockEq).toHaveBeenCalledWith("id", "agent-456");
      
      // Verify no privileged operations were performed
      expect(mockServiceFrom).not.toHaveBeenCalled();
    });

    it("returns 404 when record does not exist", async () => {
      const userId = "user-123";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      // Mock record not found
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Record not found" },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const request = createPostRequest({
        record_id: "nonexistent-id",
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("Record not found");
      
      // Verify no processing occurred
      expect(mockServiceFrom).not.toHaveBeenCalled();
    });

    it("returns 404 when record fetch returns null data without error", async () => {
      const userId = "user-123";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      // Mock record not found (null data, no error)
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const request = createPostRequest({
        record_id: "nonexistent-id",
        record_type: "agent",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("Record not found");
    });
  });

  describe("Successful processing with proper authorization", () => {
    it("processes overlord record when user owns it", async () => {
      const userId = "user-123";
      const recordId = "overlord-123";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      // Mock ownership check - user owns the record
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: recordId, owner_id: userId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      // Mock successful trait extraction
      const mockTraits = {
        primary_color: "orange",
        pattern_type: "tabby",
        fur_length: "short",
        breed_estimate: "Domestic Shorthair",
        distinguishing_features: ["white paws", "M marking on forehead"],
      };
      mockExtractTraitsFromImage.mockResolvedValue(mockTraits);

      // Mock successful database update
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      mockServiceFrom.mockReturnValue({ update: mockUpdate });

      // Mock successful match evaluation
      mockTriggerMatchEvaluation.mockResolvedValue(undefined);

      const request = createPostRequest({
        record_id: recordId,
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.record_id).toBe(recordId);
      expect(json.tagging_status).toBe("complete");
      expect(json.trait_tags).toEqual(mockTraits);
      
      // Verify ownership was checked before processing
      expect(mockAuthFrom).toHaveBeenCalledWith("overlords");
      expect(mockAuthSelect).toHaveBeenCalledWith("id, owner_id");
      
      // Verify processing occurred with service role client
      expect(mockExtractTraitsFromImage).toHaveBeenCalledWith("https://example.com/photo.jpg");
      expect(mockServiceFrom).toHaveBeenCalledWith("overlords");
      expect(mockUpdate).toHaveBeenCalledWith({
        tagging_status: "complete",
        trait_tags: mockTraits,
      });
      expect(mockUpdateEq).toHaveBeenCalledWith("id", recordId);
      
      // Verify match evaluation was triggered
      expect(mockTriggerMatchEvaluation).toHaveBeenCalledWith(
        expect.anything(),
        recordId,
        "overlord"
      );
    });

    it("processes agent record when user owns it", async () => {
      const userId = "user-456";
      const recordId = "agent-789";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      // Mock ownership check - user owns the record (reporter_id for agents)
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: recordId, reporter_id: userId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      // Mock successful trait extraction
      const mockTraits = {
        primary_color: "black",
        pattern_type: "solid",
        fur_length: "medium",
        breed_estimate: "Mixed Breed",
        distinguishing_features: ["white chest patch"],
      };
      mockExtractTraitsFromImage.mockResolvedValue(mockTraits);

      // Mock successful database update
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      mockServiceFrom.mockReturnValue({ update: mockUpdate });

      mockTriggerMatchEvaluation.mockResolvedValue(undefined);

      const request = createPostRequest({
        record_id: recordId,
        record_type: "agent",
        photo_url: "https://example.com/cat.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.record_id).toBe(recordId);
      expect(json.tagging_status).toBe("complete");
      
      // Verify correct ownership field was checked for agents
      expect(mockAuthFrom).toHaveBeenCalledWith("agents");
      expect(mockAuthSelect).toHaveBeenCalledWith("id, reporter_id");
      
      // Verify processing occurred
      expect(mockServiceFrom).toHaveBeenCalledWith("agents");
    });

    it("handles incomplete trait extraction without triggering match evaluation", async () => {
      const userId = "user-123";
      const recordId = "overlord-incomplete";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: recordId, owner_id: userId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      // Mock incomplete extraction (returns null)
      mockExtractTraitsFromImage.mockResolvedValue(null);

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      mockServiceFrom.mockReturnValue({ update: mockUpdate });

      const request = createPostRequest({
        record_id: recordId,
        record_type: "overlord",
        photo_url: "https://example.com/blurry.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.tagging_status).toBe("incomplete");
      expect(json.trait_tags).toBeNull();
      
      // Verify match evaluation was NOT triggered for incomplete tagging
      expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
      
      // Verify update only included status, not traits
      expect(mockUpdate).toHaveBeenCalledWith({
        tagging_status: "incomplete",
      });
    });

    it("handles extraction failure and marks for manual review", async () => {
      const userId = "user-123";
      const recordId = "overlord-error";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: recordId, owner_id: userId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      // Mock extraction failure
      mockExtractTraitsFromImage.mockRejectedValue(new Error("API rate limit exceeded"));

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      mockServiceFrom.mockReturnValue({ update: mockUpdate });

      const request = createPostRequest({
        record_id: recordId,
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.tagging_status).toBe("manual_review");
      expect(json.trait_tags).toBeNull();
      
      // Verify match evaluation was NOT triggered
      expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
    });
  });

  describe("Input validation", () => {
    it("returns 400 when record_id is missing", async () => {
      const request = createPostRequest({
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Missing required fields");
      
      // Verify no auth checks were performed
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("returns 400 when record_type is missing", async () => {
      const request = createPostRequest({
        record_id: "overlord-123",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Missing required fields");
    });

    it("returns 400 when photo_url is missing", async () => {
      const request = createPostRequest({
        record_id: "overlord-123",
        record_type: "overlord",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Missing required fields");
    });

    it("returns 400 when record_type is invalid", async () => {
      const request = createPostRequest({
        record_id: "overlord-123",
        record_type: "invalid_type",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("record_type must be 'overlord' or 'agent'");
    });
  });

  describe("Database error handling", () => {
    it("returns 500 when database update fails", async () => {
      const userId = "user-123";
      const recordId = "overlord-123";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: recordId, owner_id: userId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      mockExtractTraitsFromImage.mockResolvedValue({
        primary_color: "orange",
        pattern_type: "tabby",
        fur_length: "short",
        breed_estimate: "Domestic Shorthair",
        distinguishing_features: [],
      });

      // Mock database update failure
      const mockUpdateEq = vi.fn().mockResolvedValue({ 
        error: { message: "Database connection failed" } 
      });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      mockServiceFrom.mockReturnValue({ update: mockUpdate });

      const request = createPostRequest({
        record_id: recordId,
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain("Failed to update record");
    });

    it("continues successfully even if match evaluation fails", async () => {
      const userId = "user-123";
      const recordId = "overlord-123";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: userId } }, 
        error: null 
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: recordId, owner_id: userId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const mockTraits = {
        primary_color: "orange",
        pattern_type: "tabby",
        fur_length: "short",
        breed_estimate: "Domestic Shorthair",
        distinguishing_features: [],
      };
      mockExtractTraitsFromImage.mockResolvedValue(mockTraits);

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      mockServiceFrom.mockReturnValue({ update: mockUpdate });

      // Mock match evaluation failure
      mockTriggerMatchEvaluation.mockRejectedValue(new Error("Match service unavailable"));

      const request = createPostRequest({
        record_id: recordId,
        record_type: "overlord",
        photo_url: "https://example.com/photo.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      // Should still return success since vision processing completed
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.tagging_status).toBe("complete");
    });
  });

  describe("Security regression tests - Exploit scenarios", () => {
    it("prevents attacker from enumerating and processing victim overlord records", async () => {
      // Scenario: Attacker obtained victim's overlord ID from /api/overlords
      const attackerId = "attacker-123";
      const victimId = "victim-456";
      const victimOverlordId = "victim-overlord-789";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: attackerId } }, 
        error: null 
      });

      // Victim's record exists but attacker doesn't own it
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: victimOverlordId, owner_id: victimId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const request = createPostRequest({
        record_id: victimOverlordId,
        record_type: "overlord",
        photo_url: "https://attacker.com/malicious.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      // Must reject with 403
      expect(response.status).toBe(403);
      expect(json.error).toBe("Forbidden — you can only process your own records");
      
      // Critical: Verify no state mutation occurred
      expect(mockServiceFrom).not.toHaveBeenCalled();
      expect(mockExtractTraitsFromImage).not.toHaveBeenCalled();
      expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
    });

    it("prevents attacker from triggering match evaluation on victim records", async () => {
      // Scenario: Attacker tries to manipulate victim's match suggestions
      const attackerId = "attacker-abc";
      const victimId = "victim-def";
      const victimAgentId = "victim-agent-ghi";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: attackerId } }, 
        error: null 
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: victimAgentId, reporter_id: victimId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const request = createPostRequest({
        record_id: victimAgentId,
        record_type: "agent",
        photo_url: "https://attacker.com/trigger.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      
      // Critical: Match evaluation must never be triggered for unauthorized records
      expect(mockTriggerMatchEvaluation).not.toHaveBeenCalled();
    });

    it("prevents attacker from overwriting victim's trait_tags", async () => {
      // Scenario: Attacker tries to corrupt victim's record data
      const attackerId = "attacker-xyz";
      const victimId = "victim-uvw";
      const victimRecordId = "victim-record-rst";
      
      mockGetUser.mockResolvedValue({ 
        data: { user: { id: attackerId } }, 
        error: null 
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: victimRecordId, owner_id: victimId },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      mockAuthSelect.mockReturnValue({ eq: mockEq });
      mockAuthFrom.mockReturnValue({ select: mockAuthSelect });

      const request = createPostRequest({
        record_id: victimRecordId,
        record_type: "overlord",
        photo_url: "https://attacker.com/corrupt.jpg",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      
      // Critical: No database update should occur
      expect(mockServiceFrom).not.toHaveBeenCalled();
      
      // Verify the service role client was never instantiated for unauthorized access
      const { createServiceRoleClient } = await import("@/lib/supabaseServer");
      // The mock should not have been called since we rejected before that point
      expect(createServiceRoleClient).not.toHaveBeenCalled();
    });
  });
});

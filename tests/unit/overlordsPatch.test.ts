// tests/unit/overlordsPatch.test.ts — Unit tests for PATCH /api/overlords/[id] security fix

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

// Mock the resolution flow
vi.mock("@/lib/resolutionFlow", () => ({
  executeResolutionFlow: vi.fn().mockResolvedValue(undefined),
}));

// Mock Supabase server clients
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

import { PATCH } from "@/app/api/overlords/[id]/route";
import { NextRequest } from "next/server";
import { executeResolutionFlow } from "@/lib/resolutionFlow";

function createPatchRequest(body: unknown, overlordId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/overlords/${overlordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/overlords/[id] - Security Fix for resolved_agent_id validation", () => {
  const mockUser = { id: "owner-user-123" };
  const overlordId = "overlord-abc-123";
  const validAgentId = "agent-xyz-789";
  const invalidAgentId = "agent-invalid-999";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  describe("Authorization checks", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Unauthorized" } });

      const request = createPatchRequest({ status: "resolved" }, overlordId);
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 403 when user is not the overlord owner", async () => {
      const otherUser = { id: "other-user-456" };
      mockGetUser.mockResolvedValue({ data: { user: otherUser }, error: null });

      // Mock fetching existing overlord
      const mockSingleResult = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "active" },
        error: null,
      });
      mockEq.mockReturnValue({ single: mockSingleResult });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const request = createPatchRequest({ status: "resolved" }, overlordId);
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toContain("Forbidden");
    });
  });

  describe("resolved_agent_id validation - Security Fix", () => {
    beforeEach(() => {
      // Setup default mocks for a valid owner updating their overlord
      const mockFetchOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "active" },
        error: null,
      });
      const mockUpdateOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "resolved" },
        error: null,
      });

      // Chain for fetching existing overlord
      const mockEqId1 = vi.fn().mockReturnValue({ single: mockFetchOverlord });
      const mockSelect1 = vi.fn().mockReturnValue({ eq: mockEqId1 });

      // Chain for updating overlord
      const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockUpdateOverlord });
      const mockEqId2 = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqId2 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "overlords") {
          fromCallCount++;
          if (fromCallCount === 1) {
            return { select: mockSelect1 };
          } else if (fromCallCount === 2) {
            return { update: mockUpdateFn };
          }
        }
        // Default for match_suggestions table
        return { select: mockSelect };
      });
    });

    it("rejects resolved_agent_id when no match exists between overlord and agent", async () => {
      // Mock match validation query - no match found
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: null, // No match record found
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      mockSelect.mockReturnValue({ eq: mockEqOverlordId });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: invalidAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Invalid resolved_agent_id");
      expect(json.error).toContain("no match exists");
      
      // Verify match validation was attempted
      expect(mockEqOverlordId).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockEqAgentId).toHaveBeenCalledWith("agent_id", invalidAgentId);
      
      // Verify resolution flow was NOT called
      expect(executeResolutionFlow).not.toHaveBeenCalled();
    });

    it("accepts resolved_agent_id when a valid match exists", async () => {
      // Mock match validation query - match found
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: { agent_id: validAgentId }, // Match record exists
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      mockSelect.mockReturnValue({ eq: mockEqOverlordId });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: validAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.overlord).toBeDefined();
      
      // Verify match validation was performed
      expect(mockEqOverlordId).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockEqAgentId).toHaveBeenCalledWith("agent_id", validAgentId);
      
      // Verify resolution flow was called with the validated agent ID
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        validAgentId
      );
    });

    it("allows resolution without resolved_agent_id (null case)", async () => {
      const request = createPatchRequest({ status: "resolved" }, overlordId);
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.overlord).toBeDefined();
      
      // Verify resolution flow was called with null agent ID
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
    });

    it("returns 500 when match validation query fails", async () => {
      // Mock database error during match validation
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection error" },
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      mockSelect.mockReturnValue({ eq: mockEqOverlordId });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: validAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain("Failed to validate resolved agent");
      
      // Verify resolution flow was NOT called
      expect(executeResolutionFlow).not.toHaveBeenCalled();
    });
  });

  describe("Exploit scenario prevention", () => {
    beforeEach(() => {
      // Setup mocks for overlord owner
      const mockFetchOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "active" },
        error: null,
      });
      const mockUpdateOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "resolved" },
        error: null,
      });

      const mockEqId1 = vi.fn().mockReturnValue({ single: mockFetchOverlord });
      const mockSelect1 = vi.fn().mockReturnValue({ eq: mockEqId1 });

      const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockUpdateOverlord });
      const mockEqId2 = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqId2 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "overlords") {
          fromCallCount++;
          if (fromCallCount === 1) {
            return { select: mockSelect1 };
          } else if (fromCallCount === 2) {
            return { update: mockUpdateFn };
          }
        }
        return { select: mockSelect };
      });
    });

    it("prevents overlord owner from resolving arbitrary agent IDs not matched to their overlord", async () => {
      const arbitraryAgentId = "agent-arbitrary-unrelated-123";
      
      // Mock: no match exists for this arbitrary agent
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      mockSelect.mockReturnValue({ eq: mockEqOverlordId });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: arbitraryAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      // Should be rejected with 400
      expect(response.status).toBe(400);
      expect(json.error).toContain("Invalid resolved_agent_id");
      
      // Verify the validation checked for a match
      expect(mockEqOverlordId).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockEqAgentId).toHaveBeenCalledWith("agent_id", arbitraryAgentId);
      
      // Critical: resolution flow should NOT be executed
      expect(executeResolutionFlow).not.toHaveBeenCalled();
    });

    it("prevents overlord owner from resolving agent IDs from another user's matches", async () => {
      const otherUsersAgentId = "agent-from-different-match-456";
      
      // Mock: no match exists between THIS overlord and the other agent
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: null, // No match for this overlord-agent pair
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      mockSelect.mockReturnValue({ eq: mockEqOverlordId });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: otherUsersAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Invalid resolved_agent_id");
      expect(json.error).toContain("no match exists");
      
      // Verify resolution flow was NOT called with unauthorized agent
      expect(executeResolutionFlow).not.toHaveBeenCalled();
    });

    it("only allows resolution with agent IDs that have a match_suggestions record linking them", async () => {
      const matchedAgentId = "agent-properly-matched-789";
      
      // Mock: match exists in match_suggestions table
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: { agent_id: matchedAgentId },
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      mockSelect.mockReturnValue({ eq: mockEqOverlordId });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: matchedAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      
      // Verify the match was validated via match_suggestions table
      expect(mockSelect).toHaveBeenCalledWith("agent_id");
      expect(mockEqOverlordId).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockEqAgentId).toHaveBeenCalledWith("agent_id", matchedAgentId);
      
      // Resolution flow should be called with the validated agent
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        matchedAgentId
      );
    });
  });

  describe("Edge cases and validation", () => {
    beforeEach(() => {
      const mockFetchOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "active" },
        error: null,
      });
      const mockUpdateOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "resolved" },
        error: null,
      });

      const mockEqId1 = vi.fn().mockReturnValue({ single: mockFetchOverlord });
      const mockSelect1 = vi.fn().mockReturnValue({ eq: mockEqId1 });

      const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockUpdateOverlord });
      const mockEqId2 = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqId2 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "overlords") {
          fromCallCount++;
          if (fromCallCount === 1) {
            return { select: mockSelect1 };
          } else if (fromCallCount === 2) {
            return { update: mockUpdateFn };
          }
        }
        return { select: mockSelect };
      });
    });

    it("handles empty string resolved_agent_id as falsy (no validation needed)", async () => {
      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: "" },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      
      // Empty string is falsy, so no match validation should occur
      // Resolution flow should be called with null
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
    });

    it("validates resolved_agent_id when explicitly provided as non-empty string", async () => {
      const agentId = "agent-test-123";
      
      // Mock: match exists
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: { agent_id: agentId },
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      mockSelect.mockReturnValue({ eq: mockEqOverlordId });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: agentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      expect(response.status).toBe(200);
      
      // Validation should have occurred
      expect(mockEqOverlordId).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockEqAgentId).toHaveBeenCalledWith("agent_id", agentId);
    });

    it("returns 400 when overlord is already resolved", async () => {
      // Mock: overlord is already resolved
      const mockFetchOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "resolved" },
        error: null,
      });
      const mockEqId = vi.fn().mockReturnValue({ single: mockFetchOverlord });
      const mockSelectOverlord = vi.fn().mockReturnValue({ eq: mockEqId });
      mockFrom.mockReturnValue({ select: mockSelectOverlord });

      const request = createPatchRequest({ status: "resolved" }, overlordId);
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("already resolved");
      
      // Resolution flow should not be called
      expect(executeResolutionFlow).not.toHaveBeenCalled();
    });
  });

  describe("Security property assertions", () => {
    it("ensures resolved_agent_id validation uses match_suggestions table as allowlist", async () => {
      const agentId = "agent-allowlist-test";
      
      // Setup mocks
      const mockFetchOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "active" },
        error: null,
      });
      const mockUpdateOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "resolved" },
        error: null,
      });

      const mockEqId1 = vi.fn().mockReturnValue({ single: mockFetchOverlord });
      const mockSelect1 = vi.fn().mockReturnValue({ eq: mockEqId1 });

      const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockUpdateOverlord });
      const mockEqId2 = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqId2 });

      // Mock match validation - agent is in allowlist
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: { agent_id: agentId },
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      const mockSelectMatch = vi.fn().mockReturnValue({ eq: mockEqOverlordId });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "overlords") {
          fromCallCount++;
          if (fromCallCount === 1) {
            return { select: mockSelect1 };
          } else if (fromCallCount === 2) {
            return { update: mockUpdateFn };
          }
        } else if (table === "match_suggestions") {
          return { select: mockSelectMatch };
        }
        return { select: mockSelect };
      });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: agentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      expect(response.status).toBe(200);
      
      // Verify allowlist check was performed
      expect(mockFrom).toHaveBeenCalledWith("match_suggestions");
      expect(mockSelectMatch).toHaveBeenCalledWith("agent_id");
      expect(mockEqOverlordId).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockEqAgentId).toHaveBeenCalledWith("agent_id", agentId);
    });

    it("ensures validation happens before executeResolutionFlow is called", async () => {
      const invalidAgent = "agent-not-matched";
      
      // Setup mocks
      const mockFetchOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "active" },
        error: null,
      });
      const mockUpdateOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "resolved" },
        error: null,
      });

      const mockEqId1 = vi.fn().mockReturnValue({ single: mockFetchOverlord });
      const mockSelect1 = vi.fn().mockReturnValue({ eq: mockEqId1 });

      const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockUpdateOverlord });
      const mockEqId2 = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqId2 });

      // Mock match validation - no match found
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      const mockSelectMatch = vi.fn().mockReturnValue({ eq: mockEqOverlordId });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "overlords") {
          fromCallCount++;
          if (fromCallCount === 1) {
            return { select: mockSelect1 };
          } else if (fromCallCount === 2) {
            return { update: mockUpdateFn };
          }
        } else if (table === "match_suggestions") {
          return { select: mockSelectMatch };
        }
        return { select: mockSelect };
      });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: invalidAgent },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      expect(response.status).toBe(400);
      
      // Critical: executeResolutionFlow must NOT be called when validation fails
      expect(executeResolutionFlow).not.toHaveBeenCalled();
      
      // Verify validation was attempted
      expect(mockMaybeSingleResult).toHaveBeenCalled();
    });

    it("ensures both overlord_id and agent_id are checked in match validation", async () => {
      const agentId = "agent-double-check";
      
      // Setup mocks
      const mockFetchOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "active" },
        error: null,
      });
      const mockUpdateOverlord = vi.fn().mockResolvedValue({
        data: { id: overlordId, owner_id: mockUser.id, status: "resolved" },
        error: null,
      });

      const mockEqId1 = vi.fn().mockReturnValue({ single: mockFetchOverlord });
      const mockSelect1 = vi.fn().mockReturnValue({ eq: mockEqId1 });

      const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockUpdateOverlord });
      const mockEqId2 = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqId2 });

      // Mock match validation
      const mockMaybeSingleResult = vi.fn().mockResolvedValue({
        data: { agent_id: agentId },
        error: null,
      });
      const mockEqAgentId = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleResult });
      const mockEqOverlordId = vi.fn().mockReturnValue({ eq: mockEqAgentId });
      const mockSelectMatch = vi.fn().mockReturnValue({ eq: mockEqOverlordId });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "overlords") {
          fromCallCount++;
          if (fromCallCount === 1) {
            return { select: mockSelect1 };
          } else if (fromCallCount === 2) {
            return { update: mockUpdateFn };
          }
        } else if (table === "match_suggestions") {
          return { select: mockSelectMatch };
        }
        return { select: mockSelect };
      });

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: agentId },
        overlordId
      );
      await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      // Verify BOTH overlord_id and agent_id are used in the query
      expect(mockEqOverlordId).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockEqAgentId).toHaveBeenCalledWith("agent_id", agentId);
    });
  });
});

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

  describe("resolved_agent_id parameter - Security Fix", () => {
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

    it("ignores resolved_agent_id parameter and always calls resolution flow with null", async () => {
      // Even if client sends resolved_agent_id, it should be ignored
      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: validAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.overlord).toBeDefined();
      
      // Critical: resolution flow should ALWAYS be called with null, never with the client-supplied agent ID
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
    });

    it("allows resolution without resolved_agent_id parameter", async () => {
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

    it("does not perform any match validation queries when resolved_agent_id is supplied", async () => {
      // The endpoint should not even attempt to validate resolved_agent_id
      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: invalidAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      expect(response.status).toBe(200);
      
      // Verify no match validation queries were made
      expect(mockSelect).not.toHaveBeenCalled();
      
      // Resolution flow should be called with null
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
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

    it("prevents overlord owner from resolving arbitrary agent IDs via PATCH endpoint", async () => {
      const arbitraryAgentId = "agent-arbitrary-unrelated-123";
      
      // Attacker tries to supply an arbitrary agent ID
      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: arbitraryAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      // Request succeeds but the agent ID is ignored
      expect(response.status).toBe(200);
      
      // Critical: resolution flow should be called with null, NOT the attacker-supplied agent ID
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
      
      // Verify it was NOT called with the arbitrary agent ID
      expect(executeResolutionFlow).not.toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        arbitraryAgentId
      );
    });

    it("prevents overlord owner from resolving matched agent IDs via PATCH endpoint", async () => {
      const matchedAgentId = "agent-from-match-456";
      
      // Attacker tries to supply a matched agent ID (from match APIs)
      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: matchedAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      // Request succeeds but the agent ID is ignored
      expect(response.status).toBe(200);
      
      // Critical: resolution flow should be called with null, NOT the matched agent ID
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
      
      // Verify it was NOT called with the matched agent ID
      expect(executeResolutionFlow).not.toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        matchedAgentId
      );
    });

    it("enforces that agent resolution must go through the proper claim workflow", async () => {
      // This test documents that PATCH /api/overlords/[id] cannot be used for agent resolution
      // Agent resolution must go through PATCH /api/matches/[id]/claim with action="resolve"
      
      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: validAgentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      expect(response.status).toBe(200);
      
      // The endpoint always calls executeResolutionFlow with null
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
      
      // This means no agent will be marked as resolved via this endpoint
      // Agent resolution requires the proper claim workflow at /api/matches/[id]/claim
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

    it("ignores empty string resolved_agent_id (calls resolution flow with null)", async () => {
      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: "" },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      
      // Resolution flow should be called with null
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
    });

    it("ignores non-empty resolved_agent_id (calls resolution flow with null)", async () => {
      const agentId = "agent-test-123";

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: agentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      expect(response.status).toBe(200);
      
      // Resolution flow should be called with null, not the supplied agent ID
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
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
    it("ensures PATCH endpoint never accepts client-supplied agent IDs", async () => {
      const agentId = "agent-client-supplied";
      
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

      const request = createPatchRequest(
        { status: "resolved", resolved_agent_id: agentId },
        overlordId
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: overlordId }) });

      expect(response.status).toBe(200);
      
      // Critical: executeResolutionFlow must ALWAYS be called with null
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
      
      // Verify it was NOT called with the client-supplied agent ID
      expect(executeResolutionFlow).not.toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        agentId
      );
    });

    it("documents that agent resolution requires the claim workflow", async () => {
      // This test documents the security invariant:
      // PATCH /api/overlords/[id] can mark an overlord as resolved,
      // but it CANNOT mark any agent as resolved.
      // Agent resolution requires PATCH /api/matches/[id]/claim with action="resolve"
      
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

      const request = createPatchRequest({ status: "resolved" }, overlordId);
      await PATCH(request, { params: Promise.resolve({ id: overlordId }) });
      
      // The endpoint calls executeResolutionFlow with null
      expect(executeResolutionFlow).toHaveBeenCalledWith(
        expect.anything(),
        overlordId,
        null
      );
      
      // This means:
      // - The overlord will be marked as resolved
      // - Pending claims will be rejected
      // - Match suggestions will be cancelled
      // - But NO agent will be marked as resolved
      // 
      // To mark an agent as resolved, the owner must use the proper claim workflow
    });
  });
});

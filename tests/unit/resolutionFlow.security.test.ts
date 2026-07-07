// tests/unit/resolutionFlow.security.test.ts — Security tests for executeResolutionFlow

import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeResolutionFlow } from "@/lib/resolutionFlow";

describe("executeResolutionFlow - Security Fix for resolved_agent_id validation", () => {
  let mockServiceClient: any;
  let mockFrom: any;

  const overlordId = "overlord-test-123";
  const validAgentId = "agent-valid-456";
  const invalidAgentId = "agent-invalid-789";
  const ownerId = "owner-user-123";

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock from function
    mockFrom = vi.fn();

    // Create mock service client
    mockServiceClient = {
      from: mockFrom,
    };
  });

  // Helper function to create standard mocks for overlord and claims queries
  function setupStandardMocks() {
    // Setup: overlord fetch returns data
    const mockOverlordSingle = vi.fn().mockResolvedValue({
      data: { temporal_workflow_id: null, owner_id: ownerId },
      error: null,
    });
    const mockOverlordEq = vi.fn().mockReturnValue({ single: mockOverlordSingle });
    const mockOverlordSelect = vi.fn().mockReturnValue({ eq: mockOverlordEq });

    // Setup: no pending claims (claims query has two .eq() calls)
    const mockClaimsEq2 = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockClaimsEq1 = vi.fn().mockReturnValue({ eq: mockClaimsEq2 });
    const mockClaimsSelect = vi.fn().mockReturnValue({ eq: mockClaimsEq1 });

    return { mockOverlordSelect, mockClaimsSelect };
  }

  describe("Agent resolution authorization checks", () => {
    it("rejects agent resolution when no match exists between overlord and agent", async () => {
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - NO MATCH FOUND
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null, // No match record
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Execute and expect error
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, invalidAgentId)
      ).rejects.toThrow(/Authorization failed.*no valid claimed or resolved match exists/i);

      // Verify match validation was attempted
      expect(mockMatchSelect).toHaveBeenCalledWith("id, status");
      expect(mockMatchEq1).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockMatchEq2).toHaveBeenCalledWith("agent_id", invalidAgentId);
      expect(mockMatchIn).toHaveBeenCalledWith("status", ["claimed", "resolved"]);
    });

    it("rejects agent resolution when match exists but is in pending status", async () => {
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - match exists but in PENDING status (not claimed/resolved)
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null, // Query filters to claimed/resolved only, so pending match won't be returned
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Execute and expect error
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, validAgentId)
      ).rejects.toThrow(/Authorization failed/i);

      // Verify the query filters to claimed/resolved status only
      expect(mockMatchIn).toHaveBeenCalledWith("status", ["claimed", "resolved"]);
    });

    it("allows agent resolution when match exists in claimed status", async () => {
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - match exists in CLAIMED status
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: "match-123", status: "claimed" },
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      // Setup: agent update
      const mockAgentEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockAgentUpdate = vi.fn().mockReturnValue({ eq: mockAgentEq });

      // Setup: match suggestions update for agent
      const mockAgentMatchIn = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockAgentMatchEq = vi.fn().mockReturnValue({ in: mockAgentMatchIn });
      const mockAgentMatchUpdate = vi.fn().mockReturnValue({ eq: mockAgentMatchEq });

      // Setup: match suggestions update for overlord
      const mockOverlordMatchIn = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockOverlordMatchEq = vi.fn().mockReturnValue({ in: mockOverlordMatchIn });
      const mockOverlordMatchUpdate = vi.fn().mockReturnValue({ eq: mockOverlordMatchEq });

      // Setup: notification insert
      const mockNotificationInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions" && fromCallCount === 3) {
          return { select: mockMatchSelect };
        } else if (table === "agents") {
          return { update: mockAgentUpdate };
        } else if (table === "match_suggestions" && fromCallCount === 5) {
          return { update: mockAgentMatchUpdate };
        } else if (table === "match_suggestions" && fromCallCount === 6) {
          return { update: mockOverlordMatchUpdate };
        } else if (table === "notifications") {
          return { insert: mockNotificationInsert };
        }
        return { select: vi.fn() };
      });

      // Execute - should succeed
      await executeResolutionFlow(mockServiceClient, overlordId, validAgentId);

      // Verify match validation was performed
      expect(mockMatchSelect).toHaveBeenCalledWith("id, status");
      expect(mockMatchEq1).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockMatchEq2).toHaveBeenCalledWith("agent_id", validAgentId);
      expect(mockMatchIn).toHaveBeenCalledWith("status", ["claimed", "resolved"]);

      // Verify agent was updated
      expect(mockAgentUpdate).toHaveBeenCalledWith({ status: "resolved" });
      expect(mockAgentEq).toHaveBeenCalledWith("id", validAgentId);
    });

    it("throws error when match validation query fails", async () => {
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - database error
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection error" },
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Execute and expect error
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, validAgentId)
      ).rejects.toThrow(/Failed to validate match relationship/i);
    });
  });

  describe("Exploit scenario prevention", () => {
    it("prevents resolution of arbitrary agent IDs not matched to the overlord", async () => {
      const arbitraryAgentId = "agent-arbitrary-unrelated-999";
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - no match for arbitrary agent
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Execute and expect error
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, arbitraryAgentId)
      ).rejects.toThrow(/Authorization failed/i);

      // Verify the authorization check was performed
      expect(mockMatchEq1).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockMatchEq2).toHaveBeenCalledWith("agent_id", arbitraryAgentId);
    });

    it("prevents resolution of matched agent IDs that are only in pending status", async () => {
      const pendingMatchAgentId = "agent-pending-match-888";
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - match exists but only in pending status
      // The query filters to claimed/resolved, so it returns null
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Execute and expect error
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, pendingMatchAgentId)
      ).rejects.toThrow(/Authorization failed.*no valid claimed or resolved match exists/i);

      // Verify the status filter only allows claimed/resolved
      expect(mockMatchIn).toHaveBeenCalledWith("status", ["claimed", "resolved"]);
    });

    it("enforces that both overlord_id and agent_id must match in the authorization check", async () => {
      const agentId = "agent-test-777";
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - no match
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Execute and expect error
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, agentId)
      ).rejects.toThrow(/Authorization failed/i);

      // Verify BOTH overlord_id and agent_id are checked
      expect(mockMatchEq1).toHaveBeenCalledWith("overlord_id", overlordId);
      expect(mockMatchEq2).toHaveBeenCalledWith("agent_id", agentId);
    });
  });

  describe("Security property assertions", () => {
    it("ensures agent resolution requires a match in claimed or resolved status", async () => {
      const agentId = "agent-security-test-666";
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - no match in claimed/resolved status
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Execute and expect error
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, agentId)
      ).rejects.toThrow(/Agent resolution requires going through the proper claim workflow/i);

      // Verify the status filter is restrictive
      expect(mockMatchIn).toHaveBeenCalledWith("status", ["claimed", "resolved"]);
    });

    it("allows resolution without agent ID (manual resolution case)", async () => {
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match suggestions update for overlord
      const mockOverlordMatchIn = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockOverlordMatchEq = vi.fn().mockReturnValue({ in: mockOverlordMatchIn });
      const mockOverlordMatchUpdate = vi.fn().mockReturnValue({ eq: mockOverlordMatchEq });

      // Setup: notification insert
      const mockNotificationInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { update: mockOverlordMatchUpdate };
        } else if (table === "notifications") {
          return { insert: mockNotificationInsert };
        }
        return { select: vi.fn() };
      });

      // Execute with null agent ID - should succeed
      await executeResolutionFlow(mockServiceClient, overlordId, null);

      // Verify no agent update was attempted
      expect(mockFrom).not.toHaveBeenCalledWith("agents");
      
      // Verify overlord match suggestions were cancelled
      expect(mockOverlordMatchUpdate).toHaveBeenCalled();
    });

    it("documents the defense-in-depth: PATCH endpoint passes null, resolutionFlow validates non-null", async () => {
      // This test documents the two-layer defense:
      // 1. PATCH /api/overlords/[id] always passes null to executeResolutionFlow
      // 2. executeResolutionFlow validates any non-null agent ID against match_suggestions

      // If an attacker somehow bypasses layer 1 and calls executeResolutionFlow directly
      // with an agent ID, layer 2 will still block unauthorized agent resolution

      const unauthorizedAgentId = "agent-bypass-attempt-555";
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - no match
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions") {
          return { select: mockMatchSelect };
        }
        return { select: vi.fn() };
      });

      // Even if called directly with an agent ID, the authorization check blocks it
      await expect(
        executeResolutionFlow(mockServiceClient, overlordId, unauthorizedAgentId)
      ).rejects.toThrow(/Authorization failed/i);

      // This ensures defense-in-depth: even if the PATCH endpoint is bypassed,
      // the resolution flow itself enforces authorization
    });
  });

  describe("Integration with claim workflow", () => {
    it("documents that agent resolution should come from the claim workflow", async () => {
      // This test documents the intended flow:
      // 1. User claims a match via PATCH /api/matches/[id]/claim with action="claim"
      // 2. Match status changes to "claimed"
      // 3. User resolves via PATCH /api/matches/[id]/claim with action="resolve"
      // 4. That endpoint calls executeResolutionFlow with the validated agent ID
      // 5. executeResolutionFlow verifies the match is in claimed/resolved status
      // 6. Agent is marked as resolved

      const claimedAgentId = "agent-from-claim-workflow-444";
      const { mockOverlordSelect, mockClaimsSelect } = setupStandardMocks();

      // Setup: match validation - match exists in CLAIMED status (from claim workflow)
      const mockMatchMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: "match-from-claim-workflow", status: "claimed" },
        error: null,
      });
      const mockMatchIn = vi.fn().mockReturnValue({ maybeSingle: mockMatchMaybeSingle });
      const mockMatchEq2 = vi.fn().mockReturnValue({ in: mockMatchIn });
      const mockMatchEq1 = vi.fn().mockReturnValue({ eq: mockMatchEq2 });
      const mockMatchSelect = vi.fn().mockReturnValue({ eq: mockMatchEq1 });

      // Setup: agent update
      const mockAgentEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockAgentUpdate = vi.fn().mockReturnValue({ eq: mockAgentEq });

      // Setup: match suggestions update for agent
      const mockAgentMatchIn = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockAgentMatchEq = vi.fn().mockReturnValue({ in: mockAgentMatchIn });
      const mockAgentMatchUpdate = vi.fn().mockReturnValue({ eq: mockAgentMatchEq });

      // Setup: match suggestions update for overlord
      const mockOverlordMatchIn = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockOverlordMatchEq = vi.fn().mockReturnValue({ in: mockOverlordMatchIn });
      const mockOverlordMatchUpdate = vi.fn().mockReturnValue({ eq: mockOverlordMatchEq });

      // Setup: notification insert
      const mockNotificationInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "overlords" && fromCallCount === 1) {
          return { select: mockOverlordSelect };
        } else if (table === "claims") {
          return { select: mockClaimsSelect };
        } else if (table === "match_suggestions" && fromCallCount === 3) {
          return { select: mockMatchSelect };
        } else if (table === "agents") {
          return { update: mockAgentUpdate };
        } else if (table === "match_suggestions" && fromCallCount === 5) {
          return { update: mockAgentMatchUpdate };
        } else if (table === "match_suggestions" && fromCallCount === 6) {
          return { update: mockOverlordMatchUpdate };
        } else if (table === "notifications") {
          return { insert: mockNotificationInsert };
        }
        return { select: vi.fn() };
      });

      // Execute - should succeed because match is in claimed status
      await executeResolutionFlow(mockServiceClient, overlordId, claimedAgentId);

      // Verify the authorization check passed
      expect(mockMatchMaybeSingle).toHaveBeenCalled();
      
      // Verify agent was updated
      expect(mockAgentUpdate).toHaveBeenCalledWith({ status: "resolved" });
      expect(mockAgentEq).toHaveBeenCalledWith("id", claimedAgentId);
    });
  });
});

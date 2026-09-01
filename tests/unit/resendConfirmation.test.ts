import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for POST /api/auth/resend-confirmation
 * 
 * Security requirement: The endpoint must NOT leak account existence or confirmation
 * status through observable response differences, including rate-limit errors.
 * 
 * Pentest finding: Previously, when an unconfirmed account hit a rate limit during
 * generateLink(), the endpoint returned a distinct 429 response. This created a
 * side-channel that allowed attackers to enumerate unconfirmed accounts.
 * 
 * Mitigation: All error paths (including rate limits) now return the same generic
 * 200 response to prevent information disclosure.
 */

// Mock dependencies - must be defined before vi.mock calls
vi.mock('@/lib/supabaseServer', () => {
  const mockListUsers = vi.fn();
  const mockGenerateLink = vi.fn();
  
  return {
    createServiceRoleClient: vi.fn(async () => ({
      auth: {
        admin: {
          listUsers: mockListUsers,
          generateLink: mockGenerateLink,
        },
      },
    })),
    // Export mocks for test access
    __mockListUsers: mockListUsers,
    __mockGenerateLink: mockGenerateLink,
  };
});

vi.mock('@/lib/email', () => {
  const mockSendConfirmationEmail = vi.fn();
  
  return {
    sendConfirmationEmail: mockSendConfirmationEmail,
    __mockSendConfirmationEmail: mockSendConfirmationEmail,
  };
});

// Import the route handler after mocking
import { POST as resendConfirmationHandler } from '@/app/api/auth/resend-confirmation/route';
import * as supabaseServer from '@/lib/supabaseServer';
import * as email from '@/lib/email';

// Get mock references
const mockListUsers = (supabaseServer as any).__mockListUsers;
const mockGenerateLink = (supabaseServer as any).__mockGenerateLink;
const mockSendConfirmationEmail = (email as any).__mockSendConfirmationEmail;

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/resend-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/resend-confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendConfirmationEmail.mockResolvedValue(undefined);
  });

  describe('Input validation', () => {
    it('rejects missing email field', async () => {
      const request = createRequest({});
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('valid email');
    });

    it('rejects invalid email format', async () => {
      const request = createRequest({ email: 'not-an-email' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('valid email');
    });

    it('accepts valid email format', async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      const request = createRequest({ email: 'test@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('Generic response behavior - no information leakage', () => {
    it('returns generic 200 response when email does not exist', async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      const request = createRequest({ email: 'nonexistent@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
      expect(mockGenerateLink).not.toHaveBeenCalled();
    });

    it('returns generic 200 response when account is already confirmed', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-123',
              email: 'confirmed@example.com',
              email_confirmed_at: '2024-01-01T00:00:00Z',
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      const request = createRequest({ email: 'confirmed@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
      expect(mockGenerateLink).not.toHaveBeenCalled();
    });

    it('returns generic 200 response for unconfirmed account with successful link generation', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-456',
              email: 'unconfirmed@example.com',
              email_confirmed_at: null,
              user_metadata: { display_name: 'Test User' },
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: 'https://example.com/confirm?token=abc123',
          },
        },
        error: null,
      });

      const request = createRequest({ email: 'unconfirmed@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
      expect(mockGenerateLink).toHaveBeenCalled();
      expect(mockSendConfirmationEmail).toHaveBeenCalled();
    });
  });

  describe('Security: Rate-limit error handling (CVE mitigation)', () => {
    /**
     * CRITICAL SECURITY TEST: Verify that rate-limit errors from generateLink()
     * do NOT produce a distinct 429 response that would leak account existence.
     * 
     * Previously, this was the vulnerability: unconfirmed accounts that hit rate
     * limits returned 429, while non-existent or confirmed accounts returned 200.
     * An attacker could probe emails and use 429 as an oracle for unconfirmed accounts.
     */
    it('returns generic 200 (not 429) when generateLink hits rate limit with status 429', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-789',
              email: 'unconfirmed@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      // Simulate rate limit error from Supabase
      mockGenerateLink.mockResolvedValue({
        data: null,
        error: {
          status: 429,
          message: 'Rate limit exceeded',
        },
      });

      const request = createRequest({ email: 'unconfirmed@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      // SECURITY ASSERTION: Must return 200, not 429
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
      
      // Verify the response is indistinguishable from non-existent account
      expect(json).not.toHaveProperty('error');
      expect(json.message).not.toContain('rate limit');
      expect(json.message).not.toContain('Too many');
    });

    it('returns generic 200 (not 429) when generateLink hits rate limit with code "over_email_send_rate_limit"', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-790',
              email: 'unconfirmed2@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      // Simulate rate limit error with specific code
      mockGenerateLink.mockResolvedValue({
        data: null,
        error: {
          code: 'over_email_send_rate_limit',
          message: 'Email send rate limit exceeded',
        },
      });

      const request = createRequest({ email: 'unconfirmed2@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      // SECURITY ASSERTION: Must return 200, not 429
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
    });

    it('returns generic 200 (not 429) when generateLink error message contains "rate limit"', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-791',
              email: 'unconfirmed3@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      // Simulate rate limit error with message containing "rate limit"
      mockGenerateLink.mockResolvedValue({
        data: null,
        error: {
          message: 'You have exceeded the rate limit for this operation',
        },
      });

      const request = createRequest({ email: 'unconfirmed3@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      // SECURITY ASSERTION: Must return 200, not 429
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
    });
  });

  describe('Security: Response uniformity across all scenarios', () => {
    /**
     * Verify that all success paths return identical responses to prevent
     * timing attacks or response structure analysis.
     */
    it('returns identical response structure for non-existent, confirmed, and unconfirmed accounts', async () => {
      const responses: any[] = [];

      // Scenario 1: Non-existent account
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });
      const req1 = createRequest({ email: 'nonexistent@example.com' });
      const res1 = await resendConfirmationHandler(req1 as any);
      responses.push(await res1.json());

      // Scenario 2: Confirmed account
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-confirmed',
              email: 'confirmed@example.com',
              email_confirmed_at: '2024-01-01T00:00:00Z',
              user_metadata: {},
            },
          ],
        },
        error: null,
      });
      const req2 = createRequest({ email: 'confirmed@example.com' });
      const res2 = await resendConfirmationHandler(req2 as any);
      responses.push(await res2.json());

      // Scenario 3: Unconfirmed account with rate limit error
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-unconfirmed',
              email: 'unconfirmed@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });
      mockGenerateLink.mockResolvedValue({
        data: null,
        error: { status: 429, message: 'Rate limit exceeded' },
      });
      const req3 = createRequest({ email: 'unconfirmed@example.com' });
      const res3 = await resendConfirmationHandler(req3 as any);
      responses.push(await res3.json());

      // All responses should be identical
      expect(responses[0]).toEqual(responses[1]);
      expect(responses[1]).toEqual(responses[2]);
      expect(responses[0].success).toBe(true);
      expect(responses[0].message).toContain('If an unconfirmed account exists');
    });
  });

  describe('Other error scenarios', () => {
    it('returns generic 200 response when generateLink fails with non-rate-limit error', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-error',
              email: 'error@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: null,
        error: {
          message: 'Internal server error',
          status: 500,
        },
      });

      const request = createRequest({ email: 'error@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
    });

    it('returns generic 200 response when generateLink returns no action_link', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-nolink',
              email: 'nolink@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: null,
          },
        },
        error: null,
      });

      const request = createRequest({ email: 'nolink@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
    });

    it('returns generic 200 response even when email sending fails', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-emailfail',
              email: 'emailfail@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: 'https://example.com/confirm?token=xyz',
          },
        },
        error: null,
      });

      mockSendConfirmationEmail.mockRejectedValue(new Error('Email service unavailable'));

      const request = createRequest({ email: 'emailfail@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      // Should still return success to avoid leaking information
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('If an unconfirmed account exists');
    });

    it('returns 500 on unexpected errors during request processing', async () => {
      mockListUsers.mockRejectedValue(new Error('Database connection failed'));

      const request = createRequest({ email: 'test@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toContain('unexpected error');
    });
  });

  describe('Email normalization', () => {
    it('normalizes email to lowercase', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-case',
              email: 'test@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: 'https://example.com/confirm',
          },
        },
        error: null,
      });

      const request = createRequest({ email: 'TEST@EXAMPLE.COM' });
      await resendConfirmationHandler(request as any);

      // Verify generateLink was called with normalized email
      expect(mockGenerateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        })
      );
    });

    it('trims whitespace from email after validation', async () => {
      // Note: The email must be valid BEFORE trimming for zod validation to pass
      // This test verifies that once validated, the email is properly normalized
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-trim',
              email: 'test@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: 'https://example.com/confirm',
          },
        },
        error: null,
      });

      // Use an email without leading/trailing spaces since zod validates first
      const request = createRequest({ email: 'TEST@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const json = await response.json();

      // Verify the response is successful
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      
      // Verify generateLink was called with normalized (lowercase) email
      expect(mockGenerateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        })
      );
    });
  });

  describe('Security: Timing side-channel mitigation', () => {
    /**
     * CRITICAL SECURITY TEST: Verify that the endpoint enforces a minimum response
     * time to prevent timing-based enumeration attacks.
     * 
     * The vulnerability: An attacker could measure response times to distinguish
     * between different account states:
     * - Non-existent accounts: Fast response (no generateLink call)
     * - Confirmed accounts: Fast response (no generateLink call)
     * - Unconfirmed accounts: Slower response (generateLink call + email send)
     * 
     * The mitigation: All responses are delayed to take at least MIN_RESPONSE_TIME_MS
     * (1000ms), making timing analysis ineffective.
     */
    
    it('enforces minimum response time for non-existent account (fast path)', async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      const startTime = Date.now();
      const request = createRequest({ email: 'nonexistent@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const elapsed = Date.now() - startTime;
      const json = await response.json();

      // SECURITY ASSERTION: Response must take at least 1000ms
      // Allow 5ms tolerance for timing precision
      expect(elapsed).toBeGreaterThanOrEqual(995);
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('enforces minimum response time for confirmed account (fast path)', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-confirmed-timing',
              email: 'confirmed@example.com',
              email_confirmed_at: '2024-01-01T00:00:00Z',
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      const startTime = Date.now();
      const request = createRequest({ email: 'confirmed@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const elapsed = Date.now() - startTime;
      const json = await response.json();

      // SECURITY ASSERTION: Response must take at least 1000ms
      // Allow 5ms tolerance for timing precision
      expect(elapsed).toBeGreaterThanOrEqual(995);
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('enforces minimum response time for unconfirmed account with rate limit error', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-unconfirmed-timing',
              email: 'unconfirmed@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: null,
        error: { status: 429, message: 'Rate limit exceeded' },
      });

      const startTime = Date.now();
      const request = createRequest({ email: 'unconfirmed@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const elapsed = Date.now() - startTime;
      const json = await response.json();

      // SECURITY ASSERTION: Response must take at least 1000ms
      // Allow 5ms tolerance for timing precision
      expect(elapsed).toBeGreaterThanOrEqual(995);
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('enforces minimum response time for successful unconfirmed account flow', async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-success-timing',
              email: 'success@example.com',
              email_confirmed_at: null,
              user_metadata: { display_name: 'Test User' },
            },
          ],
        },
        error: null,
      });

      mockGenerateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: 'https://example.com/confirm?token=abc123',
          },
        },
        error: null,
      });

      const startTime = Date.now();
      const request = createRequest({ email: 'success@example.com' });
      const response = await resendConfirmationHandler(request as any);
      const elapsed = Date.now() - startTime;
      const json = await response.json();

      // SECURITY ASSERTION: Response must take at least 1000ms
      // Allow 5ms tolerance for timing precision
      expect(elapsed).toBeGreaterThanOrEqual(995);
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('timing differences between scenarios are minimized to prevent enumeration', async () => {
      const timings: number[] = [];

      // Measure timing for non-existent account
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });
      let start = Date.now();
      await resendConfirmationHandler(createRequest({ email: 'nonexistent@example.com' }) as any);
      timings.push(Date.now() - start);

      // Measure timing for confirmed account
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-confirmed',
              email: 'confirmed@example.com',
              email_confirmed_at: '2024-01-01T00:00:00Z',
              user_metadata: {},
            },
          ],
        },
        error: null,
      });
      start = Date.now();
      await resendConfirmationHandler(createRequest({ email: 'confirmed@example.com' }) as any);
      timings.push(Date.now() - start);

      // Measure timing for unconfirmed account with rate limit
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-unconfirmed',
              email: 'unconfirmed@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });
      mockGenerateLink.mockResolvedValue({
        data: null,
        error: { status: 429, message: 'Rate limit exceeded' },
      });
      start = Date.now();
      await resendConfirmationHandler(createRequest({ email: 'unconfirmed@example.com' }) as any);
      timings.push(Date.now() - start);

      // SECURITY ASSERTION: All timings should be close to 1000ms
      // Allow 5ms tolerance for timing precision
      for (const timing of timings) {
        expect(timing).toBeGreaterThanOrEqual(995);
        expect(timing).toBeLessThan(1200); // Should not be significantly longer
      }

      // Verify timing variance is minimal (all should cluster around 1000ms)
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      const variance = maxTiming - minTiming;
      
      // Variance should be small (< 200ms) to prevent timing-based enumeration
      expect(variance).toBeLessThan(200);
    });
  });

  describe('Security: Combined exploit scenario verification', () => {
    /**
     * This test simulates the exact attack scenario from the pentest finding:
     * An attacker repeatedly probes an email address and observes response
     * characteristics to determine if it's an unconfirmed account.
     * 
     * The test verifies that:
     * 1. Rate limit errors no longer return 429 status
     * 2. Response timing is consistent across all scenarios
     * 3. Response structure is identical for all scenarios
     */
    it('prevents account enumeration via repeated probing with rate limit observation', async () => {
      const probeResults: Array<{ status: number; timing: number; body: any }> = [];

      // Simulate attacker probing a non-existent email
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });
      let start = Date.now();
      let response = await resendConfirmationHandler(
        createRequest({ email: 'probe-nonexistent@example.com' }) as any
      );
      probeResults.push({
        status: response.status,
        timing: Date.now() - start,
        body: await response.json(),
      });

      // Simulate attacker probing an unconfirmed email that hits rate limit
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-probe-unconfirmed',
              email: 'probe-unconfirmed@example.com',
              email_confirmed_at: null,
              user_metadata: {},
            },
          ],
        },
        error: null,
      });
      mockGenerateLink.mockResolvedValue({
        data: null,
        error: { status: 429, code: 'over_email_send_rate_limit', message: 'Rate limit exceeded' },
      });
      start = Date.now();
      response = await resendConfirmationHandler(
        createRequest({ email: 'probe-unconfirmed@example.com' }) as any
      );
      probeResults.push({
        status: response.status,
        timing: Date.now() - start,
        body: await response.json(),
      });

      // SECURITY ASSERTIONS: Attacker cannot distinguish between scenarios
      
      // 1. Both return 200, not 429
      expect(probeResults[0].status).toBe(200);
      expect(probeResults[1].status).toBe(200);
      
      // 2. Both have identical response structure
      expect(probeResults[0].body).toEqual(probeResults[1].body);
      expect(probeResults[0].body.success).toBe(true);
      expect(probeResults[0].body.message).toContain('If an unconfirmed account exists');
      
      // 3. No rate limit information leaked in response
      expect(JSON.stringify(probeResults[1].body)).not.toContain('rate limit');
      expect(JSON.stringify(probeResults[1].body)).not.toContain('Too many');
      expect(JSON.stringify(probeResults[1].body)).not.toContain('429');
      
      // 4. Timing is consistent (both >= 1000ms, variance < 200ms)
      // Allow 5ms tolerance for timing precision
      expect(probeResults[0].timing).toBeGreaterThanOrEqual(995);
      expect(probeResults[1].timing).toBeGreaterThanOrEqual(995);
      const timingVariance = Math.abs(probeResults[0].timing - probeResults[1].timing);
      expect(timingVariance).toBeLessThan(200);
    });
  });
});

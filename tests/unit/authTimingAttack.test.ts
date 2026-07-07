// tests/unit/authTimingAttack.test.ts
// Unit tests for timing attack mitigation in authentication endpoints
//
// These tests verify the mitigation for the pentest finding:
// "Login API exposes unconfirmed-account status through a distinct error response"
//
// The vulnerability allowed attackers to:
// 1. Distinguish unconfirmed accounts via different HTTP status codes (403 vs 401)
// 2. Distinguish unconfirmed accounts via different error messages and codes
// 3. Potentially use timing differences to enumerate account states
//
// The fix implements:
// 1. Uniform error responses (all auth failures return 401 with "Invalid credentials")
// 2. Timing normalization (all responses take at least MIN_AUTH_DURATION_MS)
// 3. No exposure of account state through error codes or messages

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the email module first (before any imports that use it)
vi.mock('@/lib/email', () => ({
  sendConfirmationEmail: vi.fn(),
}));

// Mock the Supabase server client module
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockListUsers = vi.fn();
const mockGenerateLink = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getUser: mockGetUser,
    },
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: mockFrom,
    auth: {
      admin: {
        listUsers: mockListUsers,
        generateLink: mockGenerateLink,
      },
    },
  })),
}));

// Import route handlers after mocking
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as resendConfirmationHandler } from '@/app/api/auth/resend-confirmation/route';

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login - Timing Attack Mitigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SECURITY: enforces minimum response time for validation failures', async () => {
    // Test that validation failures take at least MIN_AUTH_DURATION_MS (300ms)
    const request = createRequest({ email: 'invalid-email', password: 'pass123' });
    
    const startTime = Date.now();
    const response = await loginHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(400);
    expect(elapsed).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for authentication failures', async () => {
    // Test that auth failures take at least MIN_AUTH_DURATION_MS (300ms)
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const request = createRequest({ email: 'wrong@meowtrix.com', password: 'wrongpass' });
    
    const startTime = Date.now();
    const response = await loginHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(401);
    expect(elapsed).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for unconfirmed accounts', async () => {
    // Test that unconfirmed account errors take at least MIN_AUTH_DURATION_MS (300ms)
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'pass123' });
    
    const startTime = Date.now();
    const response = await loginHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(401);
    expect(elapsed).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for rate limit errors', async () => {
    // Test that rate limit errors take at least MIN_AUTH_DURATION_MS (300ms)
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Rate limit exceeded', status: 429 },
    });

    const request = createRequest({ email: 'agent@meowtrix.com', password: 'pass123' });
    
    const startTime = Date.now();
    const response = await loginHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(429);
    expect(elapsed).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for disabled accounts', async () => {
    // Test that disabled account errors take at least MIN_AUTH_DURATION_MS (300ms)
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'User account disabled', status: 403 },
    });

    const request = createRequest({ email: 'disabled@meowtrix.com', password: 'pass123' });
    
    const startTime = Date.now();
    const response = await loginHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(403);
    expect(elapsed).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for successful logins', async () => {
    // Test that successful logins also take at least MIN_AUTH_DURATION_MS (300ms)
    // This prevents timing-based enumeration of valid vs invalid credentials
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const request = createRequest({ email: 'valid@meowtrix.com', password: 'correctpass' });
    
    const startTime = Date.now();
    const response = await loginHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for unexpected errors', async () => {
    // Test that unexpected errors take at least MIN_AUTH_DURATION_MS (300ms)
    mockSignInWithPassword.mockRejectedValue(new Error('Unexpected error'));

    const request = createRequest({ email: 'test@meowtrix.com', password: 'pass123' });
    
    const startTime = Date.now();
    const response = await loginHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(500);
    expect(elapsed).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
  });

  it('SECURITY: timing variance between unconfirmed and invalid credentials is minimal', async () => {
    // Test that the timing difference between unconfirmed accounts and invalid
    // credentials is negligible (within a small tolerance)
    const timings: number[] = [];

    // Measure unconfirmed account timing
    for (let i = 0; i < 3; i++) {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: {
          message: 'Email not confirmed',
          status: 400,
          code: 'email_not_confirmed',
        },
      });

      const request = createRequest({ email: `unconfirmed${i}@meowtrix.com`, password: 'pass123' });
      const startTime = Date.now();
      await loginHandler(request as any);
      timings.push(Date.now() - startTime);
    }

    // Measure invalid credentials timing
    for (let i = 0; i < 3; i++) {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      const request = createRequest({ email: `invalid${i}@meowtrix.com`, password: 'wrongpass' });
      const startTime = Date.now();
      await loginHandler(request as any);
      timings.push(Date.now() - startTime);
    }

    // Calculate average and standard deviation
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);

    // All timings should be close to MIN_AUTH_DURATION_MS with low variance
    expect(avg).toBeGreaterThanOrEqual(300);
    expect(stdDev).toBeLessThan(50); // Variance should be minimal (< 50ms)
  });
});

describe('POST /api/auth/register - Timing Attack Mitigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SECURITY: enforces minimum response time for validation failures', async () => {
    // Test that validation failures take at least MIN_REGISTER_DURATION_MS (500ms)
    const request = createRequest({ email: 'invalid-email', password: 'pass', display_name: '' });
    
    const startTime = Date.now();
    const response = await registerHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(400);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_REGISTER_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for existing accounts', async () => {
    // Test that existing account responses take at least MIN_REGISTER_DURATION_MS (500ms)
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: 'User already registered', code: 'user_already_exists' },
    });

    const request = createRequest({
      email: 'existing@meowtrix.com',
      password: 'SecurePass123!',
      display_name: 'Existing User',
    });
    
    const startTime = Date.now();
    const response = await registerHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    // Should return generic success to prevent enumeration
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_REGISTER_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for rate limit errors', async () => {
    // Test that rate limit errors take at least MIN_REGISTER_DURATION_MS (500ms)
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded', code: 'over_email_send_rate_limit' },
    });

    const request = createRequest({
      email: 'test@meowtrix.com',
      password: 'SecurePass123!',
      display_name: 'Test User',
    });
    
    const startTime = Date.now();
    const response = await registerHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(429);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_REGISTER_DURATION_MS
  });
});

describe('POST /api/auth/resend-confirmation - Timing Attack Mitigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SECURITY: enforces minimum response time for validation failures', async () => {
    // Test that validation failures take at least MIN_RESEND_DURATION_MS (500ms)
    const request = createRequest({ email: 'invalid-email' });
    
    const startTime = Date.now();
    const response = await resendConfirmationHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(400);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_RESEND_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for non-existent accounts', async () => {
    // Test that non-existent account responses take at least MIN_RESEND_DURATION_MS (500ms)
    mockListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const request = createRequest({ email: 'nonexistent@meowtrix.com' });
    
    const startTime = Date.now();
    const response = await resendConfirmationHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    // Should return generic success message to prevent enumeration
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_RESEND_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for already confirmed accounts', async () => {
    // Test that already confirmed account responses take at least MIN_RESEND_DURATION_MS (500ms)
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-123',
            email: 'confirmed@meowtrix.com',
            email_confirmed_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
      error: null,
    });

    const request = createRequest({ email: 'confirmed@meowtrix.com' });
    
    const startTime = Date.now();
    const response = await resendConfirmationHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    // Should return generic success message to prevent enumeration
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_RESEND_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for unconfirmed accounts', async () => {
    // Test that unconfirmed account responses take at least MIN_RESEND_DURATION_MS (500ms)
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-456',
            email: 'unconfirmed@meowtrix.com',
            email_confirmed_at: null,
          },
        ],
      },
      error: null,
    });

    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: 'http://localhost:3000/api/auth/callback?token=abc123',
        },
      },
      error: null,
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com' });
    
    const startTime = Date.now();
    const response = await resendConfirmationHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_RESEND_DURATION_MS
  });

  it('SECURITY: enforces minimum response time for rate limit errors', async () => {
    // Test that rate limit errors take at least MIN_RESEND_DURATION_MS (500ms)
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-789',
            email: 'test@meowtrix.com',
            email_confirmed_at: null,
          },
        ],
      },
      error: null,
    });

    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded', code: 'over_email_send_rate_limit' },
    });

    const request = createRequest({ email: 'test@meowtrix.com' });
    
    const startTime = Date.now();
    const response = await resendConfirmationHandler(request as any);
    const elapsed = Date.now() - startTime;
    
    // Should return generic success message to prevent enumeration
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(500); // MIN_RESEND_DURATION_MS
  });
});

describe('Cross-endpoint timing consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SECURITY: all login error paths have consistent timing', async () => {
    const scenarios = [
      {
        name: 'validation failure',
        setup: () => {},
        request: { email: 'invalid-email', password: 'pass' },
      },
      {
        name: 'wrong password',
        setup: () => {
          mockSignInWithPassword.mockResolvedValue({
            data: { session: null },
            error: { message: 'Invalid login credentials', status: 400 },
          });
        },
        request: { email: 'test@meowtrix.com', password: 'wrongpass' },
      },
      {
        name: 'unconfirmed account',
        setup: () => {
          mockSignInWithPassword.mockResolvedValue({
            data: { session: null },
            error: {
              message: 'Email not confirmed',
              status: 400,
              code: 'email_not_confirmed',
            },
          });
        },
        request: { email: 'unconfirmed@meowtrix.com', password: 'pass123' },
      },
      {
        name: 'non-existent email',
        setup: () => {
          mockSignInWithPassword.mockResolvedValue({
            data: { session: null },
            error: { message: 'Invalid login credentials', status: 400 },
          });
        },
        request: { email: 'nobody@meowtrix.com', password: 'pass123' },
      },
    ];

    const timings: number[] = [];

    for (const scenario of scenarios) {
      scenario.setup();
      const request = createRequest(scenario.request);
      
      const startTime = Date.now();
      await loginHandler(request as any);
      const elapsed = Date.now() - startTime;
      
      timings.push(elapsed);
    }

    // All timings should be close to MIN_AUTH_DURATION_MS
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxTiming = Math.max(...timings);
    const minTiming = Math.min(...timings);

    expect(minTiming).toBeGreaterThanOrEqual(300); // MIN_AUTH_DURATION_MS
    expect(maxTiming - minTiming).toBeLessThan(100); // Variance should be < 100ms
  });
});

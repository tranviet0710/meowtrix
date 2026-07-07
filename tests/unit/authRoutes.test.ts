import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the email module first (before any imports that use it)
vi.mock('@/lib/email', () => ({
  sendConfirmationEmail: vi.fn(),
}));

// Mock the Supabase server client module
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockFrom = vi.fn();
const mockListUsers = vi.fn();
const mockGenerateLink = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      exchangeCodeForSession: mockExchangeCodeForSession,
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

// We need to import the route handlers after mocking
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as signoutHandler } from '@/app/api/auth/signout/route';
import { GET as callbackHandler } from '@/app/api/auth/callback/route';
import { POST as resendConfirmationHandler } from '@/app/api/auth/resend-confirmation/route';
import { sendConfirmationEmail } from '@/lib/email';

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createNextRequest(url: string, method = 'GET'): Request {
  return new Request(url, { method });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on valid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const request = createRequest({ email: 'agent@meowtrix.com', password: 'securepass123' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns generic "Invalid credentials" on wrong password — no hints (Req 1.6)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const request = createRequest({ email: 'agent@meowtrix.com', password: 'wrongpass' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid credentials');
    // Must NOT contain hints about email or password
    expect(json.error).not.toMatch(/email/i);
    expect(json.error).not.toMatch(/password/i);
  });

  it('returns generic "Invalid credentials" on non-existent email — no hints (Req 1.6)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const request = createRequest({ email: 'nobody@meowtrix.com', password: 'somepass123' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Invalid credentials');
  });

  it('returns rate-limit error on 429 status', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Rate limit exceeded', status: 429 },
    });

    const request = createRequest({ email: 'agent@meowtrix.com', password: 'pass12345' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain('Too many attempts');
  });

  it('returns disabled account error when account is disabled', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'User account disabled', status: 403 },
    });

    const request = createRequest({ email: 'agent@meowtrix.com', password: 'pass12345' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain('disabled');
  });

  it('returns 400 on missing email', async () => {
    const request = createRequest({ password: 'securepass123' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid credentials');
  });

  it('returns 400 on missing password', async () => {
    const request = createRequest({ email: 'agent@meowtrix.com' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('returns 400 on invalid email format', async () => {
    const request = createRequest({ email: 'not-an-email', password: 'securepass123' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    // Still returns generic message, not revealing what was wrong
    expect(json.error).toBe('Invalid credentials');
  });

  // ============================================================================
  // SECURITY: Account Enumeration Prevention Tests
  // ============================================================================
  // These tests verify the mitigation for the pentest finding:
  // "Login API exposes unconfirmed-account status through a distinct error response"
  //
  // The vulnerability allowed attackers to distinguish unconfirmed accounts from
  // invalid credentials by observing different HTTP status codes and error messages.
  // The fix ensures all authentication failures return the same generic response.
  // ============================================================================

  it('SECURITY: returns generic 401 for unconfirmed account (email_not_confirmed code) — prevents enumeration', async () => {
    // Simulate Supabase returning an unconfirmed account error via error.code
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'somepass123' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return same status and message as invalid credentials
    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid credentials');

    // CRITICAL: Must NOT expose the unconfirmed status
    expect(json.code).toBeUndefined();
    expect(json.error).not.toMatch(/confirm/i);
    expect(json.error).not.toMatch(/activat/i);
    expect(json.error).not.toMatch(/verif/i);
    expect(json.error).not.toMatch(/email/i);
  });

  it('SECURITY: returns generic 401 for unconfirmed account (message: "email not confirmed") — prevents enumeration', async () => {
    // Simulate Supabase returning an unconfirmed account error via error.message
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
      },
    });

    const request = createRequest({ email: 'unconfirmed2@meowtrix.com', password: 'pass456' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return same status and message as invalid credentials
    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid credentials');

    // CRITICAL: Must NOT expose the unconfirmed status
    expect(json.code).toBeUndefined();
    expect(json.error).not.toMatch(/confirm/i);
    expect(json.error).not.toMatch(/activat/i);
    expect(json.error).not.toMatch(/verif/i);
  });

  it('SECURITY: returns generic 401 for unconfirmed account (message: "not confirmed") — prevents enumeration', async () => {
    // Simulate Supabase returning a variant unconfirmed message
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'User not confirmed',
        status: 400,
      },
    });

    const request = createRequest({ email: 'unconfirmed3@meowtrix.com', password: 'pass789' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return same status and message as invalid credentials
    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid credentials');

    // CRITICAL: Must NOT expose the unconfirmed status
    expect(json.code).toBeUndefined();
    expect(json.error).not.toMatch(/confirm/i);
    expect(json.error).not.toMatch(/activat/i);
  });

  it('SECURITY: returns generic 401 for unconfirmed account (message: "not verified") — prevents enumeration', async () => {
    // Simulate Supabase returning another variant unconfirmed message
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not verified',
        status: 400,
      },
    });

    const request = createRequest({ email: 'unconfirmed4@meowtrix.com', password: 'pass000' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return same status and message as invalid credentials
    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid credentials');

    // CRITICAL: Must NOT expose the unconfirmed status
    expect(json.code).toBeUndefined();
    expect(json.error).not.toMatch(/verif/i);
    expect(json.error).not.toMatch(/confirm/i);
  });

  it('SECURITY: unconfirmed account response is indistinguishable from wrong password', async () => {
    // Test that unconfirmed account and wrong password return identical responses
    const unconfirmedRequest = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'pass123' });
    const wrongPasswordRequest = createRequest({ email: 'valid@meowtrix.com', password: 'wrongpass' });

    // Simulate unconfirmed account
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });
    const unconfirmedResponse = await loginHandler(unconfirmedRequest as any);
    const unconfirmedJson = await unconfirmedResponse.json();

    // Simulate wrong password
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Invalid login credentials',
        status: 400,
      },
    });
    const wrongPasswordResponse = await loginHandler(wrongPasswordRequest as any);
    const wrongPasswordJson = await wrongPasswordResponse.json();

    // CRITICAL: Both responses must be identical
    expect(unconfirmedResponse.status).toBe(wrongPasswordResponse.status);
    expect(unconfirmedJson.success).toBe(wrongPasswordJson.success);
    expect(unconfirmedJson.error).toBe(wrongPasswordJson.error);
    expect(unconfirmedJson.code).toBe(wrongPasswordJson.code);

    // CRITICAL: No distinguishing fields should exist
    expect(Object.keys(unconfirmedJson).sort()).toEqual(Object.keys(wrongPasswordJson).sort());
  });

  it('SECURITY: unconfirmed account response is indistinguishable from non-existent email', async () => {
    // Test that unconfirmed account and non-existent email return identical responses
    const unconfirmedRequest = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'pass123' });
    const nonExistentRequest = createRequest({ email: 'nobody@meowtrix.com', password: 'pass123' });

    // Simulate unconfirmed account
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });
    const unconfirmedResponse = await loginHandler(unconfirmedRequest as any);
    const unconfirmedJson = await unconfirmedResponse.json();

    // Simulate non-existent email
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Invalid login credentials',
        status: 400,
      },
    });
    const nonExistentResponse = await loginHandler(nonExistentRequest as any);
    const nonExistentJson = await nonExistentResponse.json();

    // CRITICAL: Both responses must be identical
    expect(unconfirmedResponse.status).toBe(nonExistentResponse.status);
    expect(unconfirmedJson.success).toBe(nonExistentJson.success);
    expect(unconfirmedJson.error).toBe(nonExistentJson.error);
    expect(unconfirmedJson.code).toBe(nonExistentJson.code);

    // CRITICAL: No distinguishing fields should exist
    expect(Object.keys(unconfirmedJson).sort()).toEqual(Object.keys(nonExistentJson).sort());
  });

  it('SECURITY: does NOT return 403 status for unconfirmed accounts', async () => {
    // The old vulnerable code returned 403 for unconfirmed accounts
    // This test ensures we never return 403 for authentication failures
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'pass123' });
    const response = await loginHandler(request as any);

    // CRITICAL: Must NOT return 403 (the old vulnerable status code)
    expect(response.status).not.toBe(403);
    expect(response.status).toBe(401);
  });

  it('SECURITY: does NOT return "email_not_confirmed" code in response', async () => {
    // The old vulnerable code returned { code: "email_not_confirmed" }
    // This test ensures we never expose this code
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'pass123' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must NOT expose the email_not_confirmed code
    expect(json.code).toBeUndefined();
    expect(json).not.toHaveProperty('code');
  });

  it('SECURITY: does NOT provide activation guidance in error message', async () => {
    // The old vulnerable code returned activation guidance
    // This test ensures we never provide such hints
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'pass123' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must NOT provide activation guidance
    expect(json.error).not.toMatch(/activat/i);
    expect(json.error).not.toMatch(/inbox/i);
    expect(json.error).not.toMatch(/confirmation link/i);
    expect(json.error).not.toMatch(/check your/i);
    expect(json.error).not.toMatch(/resend/i);
  });

  // ============================================================================
  // PENTEST REPRODUCTION VERIFICATION
  // ============================================================================
  // These tests directly verify that the specific exploit scenarios from the
  // pentest report are no longer exploitable.
  // ============================================================================

  it('PENTEST REPRO: Step 2 exploit is blocked - no distinct 403 response for unconfirmed accounts', async () => {
    // The pentest found that the handler returned a distinct 403 response with
    // code: "email_not_confirmed" for unconfirmed accounts (lines 60-68 of old code).
    // This test verifies that exploit is no longer possible.
    
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'testpass' });
    const response = await loginHandler(request as any);
    const json = await response.json();

    // CRITICAL: The old vulnerable code returned:
    // - status: 403
    // - code: "email_not_confirmed"
    // - error: "Your account has not been activated yet..."
    //
    // The fixed code must return:
    // - status: 401 (same as invalid credentials)
    // - no code field
    // - error: "Invalid credentials" (generic message)

    expect(response.status).toBe(401); // NOT 403
    expect(json.code).toBeUndefined(); // NOT "email_not_confirmed"
    expect(json.error).toBe('Invalid credentials'); // NOT activation guidance
    expect(json.error).not.toMatch(/activated/i);
    expect(json.error).not.toMatch(/confirmation/i);
  });

  it('PENTEST REPRO: attacker cannot use error.code to enumerate unconfirmed accounts', async () => {
    // The pentest found that error.code === "email_not_confirmed" was checked
    // and exposed to the client (line 58 of old code).
    // This test verifies that error.code is never exposed.
    
    const testCases = [
      {
        name: 'email_not_confirmed code',
        email: 'test1@meowtrix.com',
        error: {
          message: 'Email not confirmed',
          status: 400,
          code: 'email_not_confirmed',
        },
      },
      {
        name: 'not_confirmed message',
        email: 'test2@meowtrix.com',
        error: {
          message: 'User not confirmed',
          status: 400,
        },
      },
      {
        name: 'not verified message',
        email: 'test3@meowtrix.com',
        error: {
          message: 'Email not verified',
          status: 400,
        },
      },
    ];

    for (const testCase of testCases) {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: testCase.error,
      });

      const request = createRequest({ email: testCase.email, password: 'pass123' });
      const response = await loginHandler(request as any);
      const json = await response.json();

      // CRITICAL: No code field should ever be present in the response
      expect(json.code).toBeUndefined();
      expect(json).not.toHaveProperty('code');
      
      // CRITICAL: Response must be identical to invalid credentials
      expect(response.status).toBe(401);
      expect(json.error).toBe('Invalid credentials');
    }
  });

  it('PENTEST REPRO: attacker cannot use error.message patterns to enumerate unconfirmed accounts', async () => {
    // The pentest found that error.message was checked for patterns like
    // "email not confirmed", "not confirmed", "not verified" (lines 55-57 of old code).
    // This test verifies those patterns are never exposed to the client.
    
    const suspiciousPatterns = [
      'email not confirmed',
      'not confirmed',
      'not verified',
      'Email not confirmed',
      'User not confirmed',
      'Email not verified',
    ];

    for (const pattern of suspiciousPatterns) {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: {
          message: pattern,
          status: 400,
        },
      });

      const request = createRequest({ email: `test-${pattern.replace(/\s/g, '-')}@meowtrix.com`, password: 'pass' });
      const response = await loginHandler(request as any);
      const json = await response.json();

      // CRITICAL: The client must never see these patterns
      expect(json.error).not.toMatch(/confirm/i);
      expect(json.error).not.toMatch(/verif/i);
      expect(json.error).not.toMatch(/activat/i);
      
      // CRITICAL: Response must be generic
      expect(response.status).toBe(401);
      expect(json.error).toBe('Invalid credentials');
    }
  });

  it('PENTEST REPRO: attacker cannot distinguish account states via response structure', async () => {
    // The pentest found that different account states returned different response
    // structures, allowing enumeration. This test verifies all responses have
    // identical structure.
    
    const scenarios = [
      {
        name: 'unconfirmed account',
        error: {
          message: 'Email not confirmed',
          status: 400,
          code: 'email_not_confirmed',
        },
      },
      {
        name: 'wrong password',
        error: {
          message: 'Invalid login credentials',
          status: 400,
        },
      },
      {
        name: 'non-existent email',
        error: {
          message: 'Invalid login credentials',
          status: 400,
        },
      },
    ];

    const responses: any[] = [];

    for (const scenario of scenarios) {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: scenario.error,
      });

      const request = createRequest({ email: `${scenario.name}@meowtrix.com`, password: 'pass' });
      const response = await loginHandler(request as any);
      const json = await response.json();
      
      responses.push({
        status: response.status,
        json: json,
        keys: Object.keys(json).sort(),
      });
    }

    // CRITICAL: All responses must have identical structure
    const firstResponse = responses[0];
    for (let i = 1; i < responses.length; i++) {
      expect(responses[i].status).toBe(firstResponse.status);
      expect(responses[i].keys).toEqual(firstResponse.keys);
      expect(responses[i].json.success).toBe(firstResponse.json.success);
      expect(responses[i].json.error).toBe(firstResponse.json.error);
    }
  });

  it('PENTEST REPRO: logs do not expose email_not_confirmed code', async () => {
    // The pentest noted that error.code was logged (line 33 of old code),
    // which could leak through log aggregation systems.
    // This test verifies that error.code is no longer logged.
    
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Email not confirmed',
        status: 400,
        code: 'email_not_confirmed',
      },
    });

    const request = createRequest({ email: 'unconfirmed@meowtrix.com', password: 'pass' });
    await loginHandler(request as any);

    // Check that console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled();

    // CRITICAL: The logged error should NOT contain the code field
    const loggedArgs = consoleErrorSpy.mock.calls.find(call => 
      call[0] === '[Login] Auth error:'
    );
    
    expect(loggedArgs).toBeDefined();
    if (loggedArgs && loggedArgs[1]) {
      const loggedObject = loggedArgs[1];
      expect(loggedObject).not.toHaveProperty('code');
      expect(JSON.stringify(loggedObject)).not.toMatch(/email_not_confirmed/);
    }

    consoleErrorSpy.mockRestore();
  });
});

describe('POST /api/auth/signout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login on successful signout (Req 1.10)', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const request = createNextRequest('http://localhost:3000/api/auth/signout', 'POST');
    const response = await signoutHandler(request as any);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('returns 500 on signout failure', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Server error' } });

    const request = createNextRequest('http://localhost:3000/api/auth/signout', 'POST');
    const response = await signoutHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
  });
});

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /dashboard on successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'agent@meowtrix.com',
          user_metadata: { full_name: 'Agent Smith' },
        },
        session: {},
      },
      error: null,
    });

    // Simulate existing informant
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/auth/callback?code=abc123');
    const response = await callbackHandler(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('redirects to custom path via next param', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-456',
          email: 'new@meowtrix.com',
          user_metadata: { full_name: 'New Agent' },
        },
        session: {},
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-456' }, error: null }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/auth/callback?code=abc123&next=/matches');
    const response = await callbackHandler(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/matches');
  });

  it('falls back to /dashboard when next is absolute external URL', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-457',
          email: 'safe@meowtrix.com',
          user_metadata: { full_name: 'Safe Agent' },
        },
        session: {},
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-457' }, error: null }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/auth/callback?code=abc123&next=https://evil.com/phish');
    const response = await callbackHandler(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('falls back to /dashboard when next is protocol-relative', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-458',
          email: 'safe2@meowtrix.com',
          user_metadata: { full_name: 'Safe Agent 2' },
        },
        session: {},
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-458' }, error: null }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/auth/callback?code=abc123&next=//evil.com');
    const response = await callbackHandler(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('redirects to /login with error when code is missing', async () => {
    const request = createNextRequest('http://localhost:3000/api/auth/callback');
    const response = await callbackHandler(request as any);

    expect(response.status).toBe(307);
    const location = response.headers.get('location')!;
    expect(location).toContain('/login');
    expect(location).toContain('error=');
  });

  it('redirects to /login with error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid code' },
    });

    const request = createNextRequest('http://localhost:3000/api/auth/callback?code=invalid');
    const response = await callbackHandler(request as any);

    expect(response.status).toBe(307);
    const location = response.headers.get('location')!;
    expect(location).toContain('/login');
    expect(location).toContain('error=');
  });

  it('creates informant row for new OAuth users', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'new-user-789',
          email: 'oauth@meowtrix.com',
          user_metadata: { full_name: 'OAuth Agent' },
        },
        session: {},
      },
      error: null,
    });

    // No existing informant found
    mockFrom.mockImplementation((table: string) => {
      if (table === 'informants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
          insert: mockInsert,
        };
      }
      return {};
    });

    const request = createNextRequest('http://localhost:3000/api/auth/callback?code=newuser');
    const response = await callbackHandler(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-user-789',
        email: 'oauth@meowtrix.com',
        display_name: 'OAuth Agent',
        location_consent: false,
        residential_lat: null,
        residential_lng: null,
      })
    );
  });
});

// ============================================================================
// SECURITY: Resend Confirmation Endpoint Tests
// ============================================================================
// These tests verify that the resend-confirmation endpoint does not leak
// account existence information. It should return the same generic success
// response whether the account exists, is already confirmed, or doesn't exist.
// ============================================================================

describe('POST /api/auth/resend-confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createResendRequest(body: unknown): Request {
    return new Request('http://localhost:3000/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('SECURITY: returns generic success for non-existent email — prevents enumeration', async () => {
    // Simulate no user found
    mockListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const request = createResendRequest({ email: 'nobody@meowtrix.com' });
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return success even when account doesn't exist
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toMatch(/if an unconfirmed account exists/i);

    // CRITICAL: Must NOT reveal that the account doesn't exist
    expect(json.message).not.toMatch(/not found/i);
    expect(json.message).not.toMatch(/doesn't exist/i);
    expect(json.message).not.toMatch(/invalid/i);
  });

  it('SECURITY: returns generic success for already-confirmed email — prevents enumeration', async () => {
    // Simulate user found but already confirmed
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-123',
            email: 'confirmed@meowtrix.com',
            email_confirmed_at: '2024-01-01T00:00:00Z',
            user_metadata: { display_name: 'Confirmed User' },
          },
        ],
      },
      error: null,
    });

    const request = createResendRequest({ email: 'confirmed@meowtrix.com' });
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return same generic success message
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toMatch(/if an unconfirmed account exists/i);

    // CRITICAL: Must NOT reveal that the account is already confirmed
    expect(json.message).not.toMatch(/already confirmed/i);
    expect(json.message).not.toMatch(/already verified/i);
    expect(json.message).not.toMatch(/already activated/i);
  });

  it('SECURITY: returns generic success for unconfirmed email — consistent with other cases', async () => {
    // Simulate user found and unconfirmed
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-456',
            email: 'unconfirmed@meowtrix.com',
            email_confirmed_at: null,
            user_metadata: { display_name: 'Unconfirmed User' },
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

    vi.mocked(sendConfirmationEmail).mockResolvedValue({ id: null });

    const request = createResendRequest({ email: 'unconfirmed@meowtrix.com' });
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return same generic success message
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toMatch(/if an unconfirmed account exists/i);

    // Verify email was actually sent (but response doesn't reveal this)
    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'unconfirmed@meowtrix.com',
      })
    );
  });

  it('SECURITY: non-existent and confirmed accounts return identical responses', async () => {
    // Test non-existent account
    mockListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const nonExistentRequest = createResendRequest({ email: 'nobody@meowtrix.com' });
    const nonExistentResponse = await resendConfirmationHandler(nonExistentRequest as any);
    const nonExistentJson = await nonExistentResponse.json();

    // Test confirmed account
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-123',
            email: 'confirmed@meowtrix.com',
            email_confirmed_at: '2024-01-01T00:00:00Z',
            user_metadata: {},
          },
        ],
      },
      error: null,
    });

    const confirmedRequest = createResendRequest({ email: 'confirmed@meowtrix.com' });
    const confirmedResponse = await resendConfirmationHandler(confirmedRequest as any);
    const confirmedJson = await confirmedResponse.json();

    // CRITICAL: Both responses must be identical
    expect(nonExistentResponse.status).toBe(confirmedResponse.status);
    expect(nonExistentJson.success).toBe(confirmedJson.success);
    expect(nonExistentJson.message).toBe(confirmedJson.message);
    expect(Object.keys(nonExistentJson).sort()).toEqual(Object.keys(confirmedJson).sort());
  });

  it('SECURITY: non-existent and unconfirmed accounts return identical responses', async () => {
    // Test non-existent account
    mockListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const nonExistentRequest = createResendRequest({ email: 'nobody@meowtrix.com' });
    const nonExistentResponse = await resendConfirmationHandler(nonExistentRequest as any);
    const nonExistentJson = await nonExistentResponse.json();

    // Test unconfirmed account
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-456',
            email: 'unconfirmed@meowtrix.com',
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
          action_link: 'https://example.com/confirm?token=abc123',
        },
      },
      error: null,
    });

    vi.mocked(sendConfirmationEmail).mockResolvedValue({ id: null });

    const unconfirmedRequest = createResendRequest({ email: 'unconfirmed@meowtrix.com' });
    const unconfirmedResponse = await resendConfirmationHandler(unconfirmedRequest as any);
    const unconfirmedJson = await unconfirmedResponse.json();

    // CRITICAL: Both responses must be identical
    expect(nonExistentResponse.status).toBe(unconfirmedResponse.status);
    expect(nonExistentJson.success).toBe(unconfirmedJson.success);
    expect(nonExistentJson.message).toBe(unconfirmedJson.message);
    expect(Object.keys(nonExistentJson).sort()).toEqual(Object.keys(unconfirmedJson).sort());
  });

  it('SECURITY: returns generic success even when generateLink fails', async () => {
    // Simulate user found and unconfirmed
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-789',
            email: 'unconfirmed@meowtrix.com',
            email_confirmed_at: null,
            user_metadata: {},
          },
        ],
      },
      error: null,
    });

    // Simulate generateLink failure
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: 'Internal error', status: 500 },
    });

    const request = createResendRequest({ email: 'unconfirmed@meowtrix.com' });
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must still return generic success to avoid leaking account existence
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toMatch(/if an unconfirmed account exists/i);
  });

  it('SECURITY: returns generic success even when email sending fails', async () => {
    // Simulate user found and unconfirmed
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-999',
            email: 'unconfirmed@meowtrix.com',
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
          action_link: 'https://example.com/confirm?token=abc123',
        },
      },
      error: null,
    });

    // Simulate email sending failure
    vi.mocked(sendConfirmationEmail).mockRejectedValue(new Error('Email service unavailable'));

    const request = createResendRequest({ email: 'unconfirmed@meowtrix.com' });
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must still return generic success to avoid leaking account existence
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toMatch(/if an unconfirmed account exists/i);
  });

  it('returns 400 on missing email', async () => {
    const request = createResendRequest({});
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/email is required/i);
  });

  it('returns 400 on invalid email format', async () => {
    const request = createResendRequest({ email: 'not-an-email' });
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/email is required/i);
  });

  it('SECURITY: returns generic success even on rate limit error to prevent enumeration', async () => {
    // Simulate user found and unconfirmed
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-rate-limit',
            email: 'ratelimit@meowtrix.com',
            email_confirmed_at: null,
            user_metadata: {},
          },
        ],
      },
      error: null,
    });

    // Simulate rate limit error
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'Email rate limit exceeded',
        status: 429,
        code: 'over_email_send_rate_limit',
      },
    });

    const request = createResendRequest({ email: 'ratelimit@meowtrix.com' });
    const response = await resendConfirmationHandler(request as any);
    const json = await response.json();

    // CRITICAL: Must return generic success to prevent enumeration
    // Even rate limit errors return 200 to avoid leaking account state
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toMatch(/If an unconfirmed account exists/i);
  });

  it('normalizes email to lowercase for lookup', async () => {
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-case',
            email: 'test@meowtrix.com',
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
          action_link: 'https://example.com/confirm?token=abc123',
        },
      },
      error: null,
    });

    vi.mocked(sendConfirmationEmail).mockResolvedValue({ id: null });

    // Send with mixed case
    const request = createResendRequest({ email: 'TeSt@MeOwTrIx.CoM' });
    const response = await resendConfirmationHandler(request as any);

    expect(response.status).toBe(200);
    
    // Verify generateLink was called with normalized email
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@meowtrix.com',
      })
    );
  });
});

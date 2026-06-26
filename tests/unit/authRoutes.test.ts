import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase server client module
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// We need to import the route handlers after mocking
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as signoutHandler } from '@/app/api/auth/signout/route';
import { GET as callbackHandler } from '@/app/api/auth/callback/route';

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

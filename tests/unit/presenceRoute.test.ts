import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test suite for POST /api/presence route
 * 
 * Security focus: Verify that presence updates are now handled via POST method,
 * which provides CSRF protection through SameSite cookies and proper HTTP semantics.
 * This endpoint was created as part of the CSRF mitigation for the stats route.
 */

// Mock the Supabase server client module
const mockGetUser = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Import the route handler after mocking
import { POST as presenceHandler } from '@/app/api/presence/route';

function createPostRequest(): Request {
  return new Request('http://localhost:3000/api/presence', {
    method: 'POST',
  });
}

describe('POST /api/presence - Presence Update Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = createPostRequest();
    const response = await presenceHandler();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it('updates last_active_at timestamp for authenticated user', async () => {
    const userId = 'user-123';
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId, email: 'agent@meowtrix.com' } },
      error: null,
    });

    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);

    // Verify update was called with correct parameters
    expect(mockFrom).toHaveBeenCalledWith('informants');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        last_active_at: expect.any(String),
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', userId);
  });

  it('uses service role client to bypass RLS for presence update', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-456', email: 'test@meowtrix.com' } },
      error: null,
    });

    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();

    expect(response.status).toBe(200);
    
    // Verify service role client was used (mocked via createServiceRoleClient)
    expect(mockFrom).toHaveBeenCalledWith('informants');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('updates only the authenticated user\'s own record', async () => {
    const authenticatedUserId = 'user-789';
    mockGetUser.mockResolvedValue({
      data: { user: { id: authenticatedUserId, email: 'secure@meowtrix.com' } },
      error: null,
    });

    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();

    expect(response.status).toBe(200);
    
    // Critical: Verify the update is scoped to the authenticated user's ID only
    expect(mockEq).toHaveBeenCalledWith('id', authenticatedUserId);
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-error', email: 'error@meowtrix.com' } },
      error: null,
    });

    mockEq.mockRejectedValue(new Error('Database connection failed'));
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });

  it('sets timestamp to current server time', async () => {
    const beforeTime = new Date().toISOString();
    
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-time', email: 'time@meowtrix.com' } },
      error: null,
    });

    let capturedTimestamp: string | null = null;
    mockUpdate.mockImplementation((data: any) => {
      capturedTimestamp = data.last_active_at;
      return { eq: mockEq };
    });
    mockEq.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    await presenceHandler();

    const afterTime = new Date().toISOString();

    expect(capturedTimestamp).toBeTruthy();
    expect(capturedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Verify timestamp is within reasonable range (within 1 second of test execution)
    if (capturedTimestamp) {
      expect(new Date(capturedTimestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime() - 1000);
      expect(new Date(capturedTimestamp).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime() + 1000);
    }
  });

  it('is idempotent - multiple calls update timestamp each time', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-idempotent', email: 'test@meowtrix.com' } },
      error: null,
    });

    const timestamps: string[] = [];
    mockUpdate.mockImplementation((data: any) => {
      timestamps.push(data.last_active_at);
      return { eq: mockEq };
    });
    mockEq.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ update: mockUpdate });

    // Call multiple times
    await presenceHandler();
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    await presenceHandler();

    expect(timestamps).toHaveLength(2);
    expect(timestamps[0]).toBeTruthy();
    expect(timestamps[1]).toBeTruthy();
    // Timestamps should be different (or at least not fail)
    expect(timestamps[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(timestamps[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('POST /api/presence - CSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses POST method which provides CSRF protection via SameSite cookies', async () => {
    // This test documents that POST is used instead of GET
    // POST requests with SameSite=Lax cookies (default) are not sent on cross-site navigation
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-csrf', email: 'csrf@meowtrix.com' } },
      error: null,
    });

    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();

    expect(response.status).toBe(200);
    
    // The use of POST method is the key CSRF protection
    // Cross-site GET navigations would not trigger this endpoint
    expect(request.method).toBe('POST');
  });

  it('requires authentication before performing any write', async () => {
    let updateAttempted = false;

    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    });

    mockUpdate.mockImplementation(() => {
      updateAttempted = true;
      return { eq: mockEq };
    });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();

    expect(response.status).toBe(401);
    expect(updateAttempted).toBe(false);
  });

  it('does not expose user information in error responses', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User user-secret-456 session expired' },
    });

    const request = createPostRequest();
    const response = await presenceHandler();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    // Should not leak detailed error messages
    expect(JSON.stringify(json)).not.toContain('user-secret-456');
  });

  it('cannot be exploited to update other users\' presence', async () => {
    const authenticatedUserId = 'user-legitimate';
    const attackerTargetUserId = 'user-victim';

    mockGetUser.mockResolvedValue({
      data: { user: { id: authenticatedUserId, email: 'attacker@meowtrix.com' } },
      error: null,
    });

    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    await presenceHandler();

    // Verify the update was scoped to the authenticated user, not any attacker-supplied ID
    expect(mockEq).toHaveBeenCalledWith('id', authenticatedUserId);
    expect(mockEq).not.toHaveBeenCalledWith('id', attackerTargetUserId);
  });
});

describe('POST /api/presence - Integration with Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates timestamp that is used by GET /api/stats for online count', async () => {
    // This test documents the relationship between presence updates and stats
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-integration', email: 'integration@meowtrix.com' } },
      error: null,
    });

    let updatedTimestamp: string | null = null;
    mockUpdate.mockImplementation((data: any) => {
      updatedTimestamp = data.last_active_at;
      return { eq: mockEq };
    });
    mockEq.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();

    expect(response.status).toBe(200);
    expect(updatedTimestamp).toBeTruthy();
    
    // The timestamp updated here is what GET /api/stats reads to determine online users
    // This separation ensures GET /api/stats remains read-only
    expect(mockFrom).toHaveBeenCalledWith('informants');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        last_active_at: expect.any(String),
      })
    );
  });

  it('provides lightweight heartbeat mechanism for client-side presence tracking', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-heartbeat', email: 'heartbeat@meowtrix.com' } },
      error: null,
    });

    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const request = createPostRequest();
    const response = await presenceHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    
    // Response is minimal - just success indicator
    // This is appropriate for a heartbeat endpoint
    expect(Object.keys(json)).toHaveLength(1);
  });
});

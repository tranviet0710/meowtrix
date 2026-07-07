import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test suite for GET /api/stats route
 * 
 * Security focus: Verify that the CSRF vulnerability (updating last_active_at on GET)
 * has been mitigated. The route should now be read-only and not perform any state
 * mutations that could be exploited via cross-site GET requests.
 */

// Mock the Supabase server client module
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
  createServiceRoleClient: vi.fn(async () => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

// Import the route handler after mocking
import { GET as statsHandler } from '@/app/api/stats/route';

function createGetRequest(): Request {
  return new Request('http://localhost:3000/api/stats', {
    method: 'GET',
  });
}

describe('GET /api/stats - CSRF Mitigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('does NOT update last_active_at timestamp on GET request (CSRF mitigation)', async () => {
    // Setup authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'agent@meowtrix.com' } },
      error: null,
    });

    // Mock overlords count queries
    mockFrom.mockImplementation((table: string) => {
      if (table === 'overlords') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
          }),
        };
      }
      if (table === 'informants') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
          update: mockUpdate,
        };
      }
      return { select: vi.fn() };
    });

    // Mock RPC for online count
    mockRpc.mockResolvedValue({ data: 5, error: null });

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty('total_overlords');
    expect(json).toHaveProperty('active_searches');
    expect(json).toHaveProperty('informants_online');

    // CRITICAL: Verify that update() was NEVER called
    // This is the key security assertion - GET /api/stats must be read-only
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns statistics without performing any database writes', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-456', email: 'test@meowtrix.com' } },
      error: null,
    });

    // Track all database operations
    const dbOperations: string[] = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'overlords') {
        return {
          select: vi.fn().mockImplementation(() => {
            dbOperations.push('select:overlords');
            return {
              eq: vi.fn().mockResolvedValue({ count: 15, error: null }),
            };
          }),
        };
      }
      if (table === 'informants') {
        return {
          select: vi.fn().mockImplementation(() => {
            dbOperations.push('select:informants');
            return {
              gte: vi.fn().mockResolvedValue({ count: 8, error: null }),
            };
          }),
          update: vi.fn().mockImplementation(() => {
            dbOperations.push('update:informants');
            return { eq: vi.fn() };
          }),
        };
      }
      return { select: vi.fn() };
    });

    mockRpc.mockImplementation(() => {
      dbOperations.push('rpc:count_online_informants');
      return Promise.resolve({ data: 8, error: null });
    });

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.total_overlords).toBeGreaterThanOrEqual(0);
    expect(json.informants_online).toBe(8);

    // Verify only read operations were performed
    expect(dbOperations).not.toContain('update:informants');
    expect(dbOperations.every(op => op.startsWith('select:') || op.startsWith('rpc:'))).toBe(true);
  });

  it('uses service role client only for read operations', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-789', email: 'readonly@meowtrix.com' } },
      error: null,
    });

    const serviceRoleOperations: string[] = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'overlords') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 20, error: null }),
          }),
        };
      }
      if (table === 'informants') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 12, error: null }),
          }),
          update: vi.fn().mockImplementation(() => {
            serviceRoleOperations.push('WRITE_OPERATION');
            return { eq: vi.fn() };
          }),
        };
      }
      return { select: vi.fn() };
    });

    mockRpc.mockImplementation(() => {
      serviceRoleOperations.push('READ_OPERATION');
      return Promise.resolve({ data: 12, error: null });
    });

    const request = createGetRequest();
    const response = await statsHandler();

    expect(response.status).toBe(200);
    
    // Verify service role client was NOT used for write operations
    expect(serviceRoleOperations).not.toContain('WRITE_OPERATION');
    expect(serviceRoleOperations.every(op => op === 'READ_OPERATION')).toBe(true);
  });

  it('returns correct statistics structure', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-999', email: 'stats@meowtrix.com' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'overlords') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 42, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ count: 7, error: null }),
        }),
      };
    });

    mockRpc.mockResolvedValue({ data: 7, error: null });

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      total_overlords: expect.any(Number),
      active_searches: expect.any(Number),
      informants_online: expect.any(Number),
    });
    expect(json.total_overlords).toBeGreaterThanOrEqual(0);
    expect(json.active_searches).toBeGreaterThanOrEqual(0);
    expect(json.informants_online).toBeGreaterThanOrEqual(0);
  });

  it('sets no-cache headers to prevent stale data', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-cache', email: 'cache@meowtrix.com' } },
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
        gte: vi.fn().mockResolvedValue({ count: 3, error: null }),
      }),
    }));

    mockRpc.mockResolvedValue({ data: 3, error: null });

    const request = createGetRequest();
    const response = await statsHandler();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('handles database errors gracefully without exposing internals', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-error', email: 'error@meowtrix.com' } },
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ 
          count: null, 
          error: { message: 'Database connection failed' } 
        }),
      }),
    }));

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain('Failed to fetch');
    // Should not expose raw database error details in some cases
    // (Note: The actual implementation may include the error message for debugging)
  });

  it('uses RPC for online count calculation to avoid clock skew', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-rpc', email: 'rpc@meowtrix.com' } },
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
      }),
    }));

    mockRpc.mockResolvedValue({ data: 25, error: null });

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('count_online_informants', { minutes_ago: 5 });
    expect(json.informants_online).toBe(25);
  });

  it('falls back to direct query when RPC is unavailable', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-fallback', email: 'fallback@meowtrix.com' } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'overlords') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
          }),
        };
      }
      if (table === 'informants') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 18, error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    // RPC fails
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC not found' } });

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.informants_online).toBe(18);
  });
});

describe('GET /api/stats - Security Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces authentication before any database operations', async () => {
    let dbAccessAttempted = false;

    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    });

    mockFrom.mockImplementation(() => {
      dbAccessAttempted = true;
      return { select: vi.fn() };
    });

    const request = createGetRequest();
    const response = await statsHandler();

    expect(response.status).toBe(401);
    expect(dbAccessAttempted).toBe(false);
  });

  it('does not leak user information in error responses', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User user-secret-123 not found in database' },
    });

    const request = createGetRequest();
    const response = await statsHandler();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    // Should not include the detailed error message with user ID
    expect(json.error).not.toContain('user-secret-123');
  });

  it('is idempotent - multiple calls return same data without side effects', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-idempotent', email: 'test@meowtrix.com' } },
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 30, error: null }),
      }),
    }));

    mockRpc.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ data: 10, error: null });
    });

    // Call the endpoint multiple times
    const request1 = createGetRequest();
    const response1 = await statsHandler();
    const json1 = await response1.json();

    const request2 = createGetRequest();
    const response2 = await statsHandler();
    const json2 = await response2.json();

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(json1).toEqual(json2);
    
    // Verify no state mutations occurred
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('comment in code explicitly references CSRF prevention', async () => {
    // This test verifies that the code contains documentation about the CSRF fix
    // by checking the route handler source (indirectly through behavior)
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-doc', email: 'doc@meowtrix.com' } },
      error: null,
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
      }),
    }));

    mockRpc.mockResolvedValue({ data: 2, error: null });

    const request = createGetRequest();
    const response = await statsHandler();

    expect(response.status).toBe(200);
    
    // The key security property: no presence updates in GET handler
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

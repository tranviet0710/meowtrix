import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Unit tests for GET /api/matches/[id] route
 * 
 * Security focus: Verify that verbose Supabase/PostgREST error messages
 * are NOT reflected to authenticated clients (pentest finding mitigation).
 * 
 * The route should:
 * 1. Return generic error messages for all non-404 errors
 * 2. Log detailed errors server-side only (console.error)
 * 3. Never expose raw matchError.message or error.message to clients
 */

// Mock console.error to verify server-side logging
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock Supabase client
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

// Import the route handler after mocking
import { GET as matchDetailHandler } from '@/app/api/matches/[id]/route';

function createNextRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/matches/[id] - Error Message Disclosure Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
  });

  it('returns generic error message when Supabase query fails with verbose error', async () => {
    // Setup: authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'agent@meowtrix.com' } },
      error: null,
    });

    // Simulate a verbose Supabase error (e.g., syntax error, constraint violation)
    const verboseError = {
      message: 'syntax error at or near "invalid" in query: SELECT * FROM match_suggestions WHERE id = invalid',
      code: 'PGRST301',
      details: 'PostgreSQL error: column "invalid" does not exist',
      hint: 'Perhaps you meant to reference the column "id"',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: verboseError,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/test-id');
    const params = { params: Promise.resolve({ id: 'test-id' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Security assertion: response must NOT contain verbose error details
    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch match suggestion');
    expect(json.error).not.toContain('syntax error');
    expect(json.error).not.toContain('PostgreSQL');
    expect(json.error).not.toContain('PGRST301');
    expect(json.error).not.toContain(verboseError.message);
    expect(json.error).not.toContain(verboseError.details);
    expect(json.error).not.toContain(verboseError.hint);

    // Verify server-side logging occurred
    expect(mockConsoleError).toHaveBeenCalledWith('Match fetch error:', verboseError);
  });

  it('returns generic error message for database constraint violations', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-456', email: 'agent2@meowtrix.com' } },
      error: null,
    });

    // Simulate a constraint violation error
    const constraintError = {
      message: 'duplicate key value violates unique constraint "match_suggestions_pkey"',
      code: '23505',
      details: 'Key (id)=(abc-123) already exists.',
      schema: 'public',
      table: 'match_suggestions',
      constraint: 'match_suggestions_pkey',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: constraintError,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/abc-123');
    const params = { params: Promise.resolve({ id: 'abc-123' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Security assertion: no database schema details leaked
    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch match suggestion');
    expect(json.error).not.toContain('constraint');
    expect(json.error).not.toContain('duplicate key');
    expect(json.error).not.toContain('match_suggestions_pkey');
    expect(json.error).not.toContain('23505');
    expect(json.error).not.toContain('public');

    // Verify server-side logging
    expect(mockConsoleError).toHaveBeenCalledWith('Match fetch error:', constraintError);
  });

  it('returns generic error message for permission/RLS policy violations', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-789', email: 'agent3@meowtrix.com' } },
      error: null,
    });

    // Simulate an RLS policy violation
    const rlsError = {
      message: 'new row violates row-level security policy for table "match_suggestions"',
      code: '42501',
      details: 'Policy "match_suggestions_select_policy" failed for user "authenticated"',
      hint: 'Check your RLS policies',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: rlsError,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/xyz-789');
    const params = { params: Promise.resolve({ id: 'xyz-789' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Security assertion: no RLS policy details leaked
    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch match suggestion');
    expect(json.error).not.toContain('row-level security');
    expect(json.error).not.toContain('policy');
    expect(json.error).not.toContain('42501');
    expect(json.error).not.toContain('RLS');

    // Verify server-side logging
    expect(mockConsoleError).toHaveBeenCalledWith('Match fetch error:', rlsError);
  });

  it('returns specific 404 message for PGRST116 not-found error (allowed)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-404', email: 'agent4@meowtrix.com' } },
      error: null,
    });

    // PGRST116 is the only error code that gets special handling
    const notFoundError = {
      message: 'JSON object requested, multiple (or no) rows returned',
      code: 'PGRST116',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: notFoundError,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/nonexistent');
    const params = { params: Promise.resolve({ id: 'nonexistent' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // 404 errors are allowed to have a specific message
    expect(response.status).toBe(404);
    expect(json.error).toBe('Match suggestion not found');
    
    // Should NOT log to console.error for expected 404s
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('returns generic error message when catch block is triggered', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-500', email: 'agent5@meowtrix.com' } },
      error: null,
    });

    // Simulate an unexpected error in the try block
    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected database connection failure: timeout after 30s');
    });

    const request = createNextRequest('http://localhost:3000/api/matches/error-id');
    const params = { params: Promise.resolve({ id: 'error-id' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Security assertion: catch block error message is generic
    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch match detail');
    expect(json.error).not.toContain('database connection');
    expect(json.error).not.toContain('timeout');
    expect(json.error).not.toContain('30s');

    // Verify server-side logging
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Match detail fetch error:',
      expect.any(Error)
    );
  });

  it('returns generic error for malformed UUID errors', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-uuid', email: 'agent6@meowtrix.com' } },
      error: null,
    });

    // Simulate UUID validation error
    const uuidError = {
      message: 'invalid input syntax for type uuid: "not-a-valid-uuid-format"',
      code: '22P02',
      details: 'The input string is not a valid UUID format',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: uuidError,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/not-a-valid-uuid-format');
    const params = { params: Promise.resolve({ id: 'not-a-valid-uuid-format' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Security assertion: no UUID validation details leaked
    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch match suggestion');
    expect(json.error).not.toContain('invalid input syntax');
    expect(json.error).not.toContain('uuid');
    expect(json.error).not.toContain('22P02');
    expect(json.error).not.toContain(uuidError.message);

    // Verify server-side logging
    expect(mockConsoleError).toHaveBeenCalledWith('Match fetch error:', uuidError);
  });

  it('returns generic error for connection timeout errors', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-timeout', email: 'agent7@meowtrix.com' } },
      error: null,
    });

    // Simulate connection timeout
    const timeoutError = {
      message: 'Connection timeout: could not connect to server at supabase.co:5432',
      code: 'ETIMEDOUT',
      details: 'Network unreachable after 30000ms',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: timeoutError,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/timeout-test');
    const params = { params: Promise.resolve({ id: 'timeout-test' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Security assertion: no infrastructure details leaked
    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch match suggestion');
    expect(json.error).not.toContain('timeout');
    expect(json.error).not.toContain('supabase.co');
    expect(json.error).not.toContain('5432');
    expect(json.error).not.toContain('ETIMEDOUT');

    // Verify server-side logging
    expect(mockConsoleError).toHaveBeenCalledWith('Match fetch error:', timeoutError);
  });

  it('returns 401 for unauthenticated requests without leaking auth details', async () => {
    // Simulate authentication failure
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired at 2024-01-01T00:00:00Z', code: 'invalid_jwt' },
    });

    const request = createNextRequest('http://localhost:3000/api/matches/some-id');
    const params = { params: Promise.resolve({ id: 'some-id' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Security assertion: no JWT details leaked
    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    expect(json.error).not.toContain('JWT');
    expect(json.error).not.toContain('expired');
    expect(json.error).not.toContain('invalid_jwt');
  });

  it('successfully returns match data without exposing internal fields', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'owner-123', email: 'owner@meowtrix.com' } },
      error: null,
    });

    // Simulate successful match fetch
    const matchData = {
      id: 'match-123',
      overlord_id: 'overlord-456',
      agent_id: 'agent-789',
      overall_score: 85,
      visual_score: 90,
      description_score: 80,
      proximity_score: 85,
      other_score: 85,
      matched_traits: ['orange', 'fluffy'],
      status: 'pending',
      created_at: '2024-01-01T00:00:00Z',
      overlords: {
        id: 'overlord-456',
        owner_id: 'owner-123',
        pet_name: 'Fluffy',
        pet_type: 'cat',
      },
      agents: {
        id: 'agent-789',
        reporter_id: 'reporter-456',
      },
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: matchData,
            error: null,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/match-123');
    const params = { params: Promise.resolve({ id: 'match-123' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    // Verify successful response
    expect(response.status).toBe(200);
    expect(json.match).toBeDefined();
    expect(json.match.id).toBe('match-123');
    expect(json.match.overall_score).toBe(85);
    
    // No error logging for successful requests
    expect(mockConsoleError).not.toHaveBeenCalled();
  });
});

describe('GET /api/matches/[id] - Authorization Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
  });

  it('returns 403 when user is not involved in the match', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'unauthorized-user', email: 'other@meowtrix.com' } },
      error: null,
    });

    // Match exists but user is neither owner nor reporter
    const matchData = {
      id: 'match-999',
      overlord_id: 'overlord-111',
      agent_id: 'agent-222',
      overlords: {
        owner_id: 'different-owner',
      },
      agents: {
        reporter_id: 'different-reporter',
      },
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: matchData,
            error: null,
          }),
        }),
      }),
    });

    const request = createNextRequest('http://localhost:3000/api/matches/match-999');
    const params = { params: Promise.resolve({ id: 'match-999' }) };
    const response = await matchDetailHandler(request, params);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Forbidden: You are not involved in this match');
  });
});

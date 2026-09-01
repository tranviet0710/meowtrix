import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registrationSchema } from '@/lib/validators';
import { NextRequest } from 'next/server';

// Mock the Supabase modules before importing the route
vi.mock('@/lib/supabaseServer', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

// Mock the email module to prevent actual email sends during tests
vi.mock('@/lib/email', () => ({
  sendConfirmationEmail: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
}));

describe('Registration API - Input Validation', () => {
  describe('registrationSchema validation', () => {
    it('accepts a valid registration payload', () => {
      const input = {
        email: 'informant@meowtrix.io',
        password: 'str0ngP@ss',
        display_name: 'AgentWhiskers',
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid email format', () => {
      const input = {
        email: 'not-valid-email',
        password: 'str0ngP@ss',
        display_name: 'Agent',
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('rejects a password shorter than 8 characters', () => {
      const input = {
        email: 'a@b.com',
        password: '1234567',
        display_name: 'Agent',
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
        expect(result.error.issues[0].message).toContain('at least 8');
      }
    });

    it('accepts a password of exactly 8 characters', () => {
      const input = {
        email: 'a@b.com',
        password: '12345678',
        display_name: 'Agent',
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts a password of exactly 128 characters', () => {
      const input = {
        email: 'a@b.com',
        password: 'x'.repeat(128),
        display_name: 'Agent',
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects a password longer than 128 characters', () => {
      const input = {
        email: 'a@b.com',
        password: 'x'.repeat(129),
        display_name: 'Agent',
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
      }
    });

    it('rejects an empty display name', () => {
      const input = {
        email: 'a@b.com',
        password: 'securepass',
        display_name: '',
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('display_name');
      }
    });

    it('rejects a display name exceeding 100 characters', () => {
      const input = {
        email: 'a@b.com',
        password: 'securepass',
        display_name: 'A'.repeat(101),
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('accepts a display name of exactly 100 characters', () => {
      const input = {
        email: 'a@b.com',
        password: 'securepass',
        display_name: 'A'.repeat(100),
      };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing email field', () => {
      const input = { password: 'securepass', display_name: 'Agent' };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing password field', () => {
      const input = { email: 'a@b.com', display_name: 'Agent' };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing display_name field', () => {
      const input = { email: 'a@b.com', password: 'securepass' };
      const result = registrationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('Location Consent Validation', () => {
  const { z } = require('zod');

  // Replicate the schema used in the location consent route for unit testing
  const locationConsentSchema = z
    .object({
      location_consent: z.boolean(),
      residential_lat: z.number().nullable().optional(),
      residential_lng: z.number().nullable().optional(),
      residential_area: z.string().max(200).optional().default(''),
    })
    .refine(
      (data: { location_consent: boolean; residential_lat?: number | null }) => {
        if (data.location_consent) {
          return data.residential_lat != null;
        }
        return true;
      },
      {
        message: 'Location coordinates are required when consent is enabled',
        path: ['residential_lat'],
      }
    )
    .refine(
      (data: { location_consent: boolean; residential_lng?: number | null }) => {
        if (data.location_consent) {
          return data.residential_lng != null;
        }
        return true;
      },
      {
        message: 'Location coordinates are required when consent is enabled',
        path: ['residential_lng'],
      }
    );

  it('accepts consent=true with valid coordinates', () => {
    const input = {
      location_consent: true,
      residential_lat: 13.7563,
      residential_lng: 100.5018,
      residential_area: 'Sukhumvit, Bangkok',
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts consent=false without coordinates', () => {
    const input = {
      location_consent: false,
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts consent=false with null coordinates', () => {
    const input = {
      location_consent: false,
      residential_lat: null,
      residential_lng: null,
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects consent=true without coordinates', () => {
    const input = {
      location_consent: true,
      residential_lat: null,
      residential_lng: null,
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects consent=true with only lat provided', () => {
    const input = {
      location_consent: true,
      residential_lat: 13.7563,
      residential_lng: null,
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects consent=true with only lng provided', () => {
    const input = {
      location_consent: true,
      residential_lat: null,
      residential_lng: 100.5018,
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects residential_area exceeding 200 characters', () => {
    const input = {
      location_consent: false,
      residential_area: 'X'.repeat(201),
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts residential_area at exactly 200 characters', () => {
    const input = {
      location_consent: true,
      residential_lat: 13.75,
      residential_lng: 100.50,
      residential_area: 'X'.repeat(200),
    };
    const result = locationConsentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('Registration API - Account Enumeration Protection', () => {
  let mockServiceClient: any;
  let POST: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock service client
    mockServiceClient = {
      auth: {
        admin: {
          generateLink: vi.fn(),
        },
      },
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    };

    const { createServiceRoleClient } = await import('@/lib/supabaseServer');
    vi.mocked(createServiceRoleClient).mockResolvedValue(mockServiceClient);

    // Import the route handler after mocks are set up
    const routeModule = await import('@/app/api/auth/register/route');
    POST = routeModule.POST;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns HTTP 200 with success response when registration succeeds', async () => {
    // Mock successful registration
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
        },
        properties: {
          action_link: 'https://example.com/confirm',
        },
      },
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'securepass123',
        display_name: 'NewUser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
    // User object should NOT be exposed to prevent enumeration
    expect(data.user).toBeUndefined();
  });

  it('returns HTTP 200 with success response when email already exists (enumeration protection)', async () => {
    // Mock duplicate email error from Supabase
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'User already registered',
        status: 422,
        code: 'user_already_exists',
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should return success to prevent enumeration
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
    // User object should NOT be exposed
    expect(data.user).toBeUndefined();
  });

  it('returns identical response structure for new and existing emails', async () => {
    // Test with new email
    mockServiceClient.auth.admin.generateLink.mockResolvedValueOnce({
      data: {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
        },
        properties: {
          action_link: 'https://example.com/confirm',
        },
      },
      error: null,
    });

    const newUserRequest = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'securepass123',
        display_name: 'NewUser',
      }),
    });

    const newUserResponse = await POST(newUserRequest);
    const newUserData = await newUserResponse.json();

    // Reset modules to get fresh handler
    vi.resetModules();
    const routeModule = await import('@/app/api/auth/register/route');
    POST = routeModule.POST;

    // Test with existing email
    mockServiceClient.auth.admin.generateLink.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'User already registered',
        status: 422,
      },
    });

    const existingUserRequest = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    const existingUserResponse = await POST(existingUserRequest);
    const existingUserData = await existingUserResponse.json();

    // Both should return 200 status
    expect(newUserResponse.status).toBe(200);
    expect(existingUserResponse.status).toBe(200);

    // Both should have success: true
    expect(newUserData.success).toBe(true);
    expect(existingUserData.success).toBe(true);

    // Both should have the same message
    expect(newUserData.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
    expect(existingUserData.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');

    // Neither should expose user object
    expect(newUserData.user).toBeUndefined();
    expect(existingUserData.user).toBeUndefined();

    // Response structure should be identical (same keys)
    expect(Object.keys(newUserData).sort()).toEqual(Object.keys(existingUserData).sort());
    
    // Responses should be byte-for-byte identical
    expect(JSON.stringify(newUserData)).toBe(JSON.stringify(existingUserData));
  });

  it('does NOT return HTTP 409 for duplicate email (prevents enumeration)', async () => {
    // Mock duplicate email error
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'User already registered',
        status: 422,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    const response = await POST(request);

    // Should NOT return 409 Conflict
    expect(response.status).not.toBe(409);
    // Should return 200 OK instead
    expect(response.status).toBe(200);
  });

  it('does NOT return "Email already in use" error message (prevents enumeration)', async () => {
    // Mock duplicate email error
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'User already registered',
        status: 422,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should NOT contain error message revealing account existence
    expect(data.error).toBeUndefined();
    expect(JSON.stringify(data).toLowerCase()).not.toContain('already in use');
    expect(JSON.stringify(data).toLowerCase()).not.toContain('already registered');
    expect(JSON.stringify(data).toLowerCase()).not.toContain('already exists');
  });

  it('handles "already been registered" error message variant', async () => {
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'Email has already been registered',
        status: 422,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
    expect(data.user).toBeUndefined();
  });

  it('handles "user already exists" error message variant', async () => {
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'User already exists',
        status: 422,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
    expect(data.user).toBeUndefined();
  });

  it('handles status 422 without specific message', async () => {
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'Unprocessable entity',
        status: 422,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
    expect(data.user).toBeUndefined();
  });

  it('returns different error for rate limiting (not enumeration)', async () => {
    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'Rate limit exceeded',
        status: 429,
        code: 'over_email_send_rate_limit',
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'securepass123',
        display_name: 'TestUser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Rate limiting should return 429, not 201
    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
    expect(data.error.toLowerCase()).toContain('wait');
  });

  it('returns different error for validation failures (not enumeration)', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'short',
        display_name: 'Test',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Validation errors should return 400, not 201
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('logs warning when duplicate email is detected', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockServiceClient.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: {
        message: 'User already registered',
        status: 422,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'securepass123',
        display_name: 'ExistingUser',
      }),
    });

    await POST(request);

    // Should log a warning for security monitoring
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Register] Attempted registration with existing email:'),
      'existing@example.com'
    );

    consoleWarnSpy.mockRestore();
  });
});

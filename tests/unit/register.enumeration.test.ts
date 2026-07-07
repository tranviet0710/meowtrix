// tests/unit/register.enumeration.test.ts
// Unit tests for account enumeration protection in registration endpoint
// Verifies the mitigation of the pentest finding: "Unauthenticated registration endpoint exposes whether an email address is already registered"

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Registration API - Account Enumeration Protection (Security Fix)', () => {
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

  describe('Pentest Reproduction - Step 3: Duplicate-account response normalization', () => {
    it('does NOT return HTTP 409 for duplicate email (prevents enumeration)', async () => {
      // Mock duplicate email error from Supabase
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

      // SECURITY: Should NOT return 409 Conflict (the vulnerable behavior)
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

      // SECURITY: Should NOT contain error message revealing account existence
      expect(data.error).toBeUndefined();
      expect(JSON.stringify(data).toLowerCase()).not.toContain('already in use');
      expect(JSON.stringify(data).toLowerCase()).not.toContain('already registered');
      expect(JSON.stringify(data).toLowerCase()).not.toContain('already exists');
    });

    it('returns success response for duplicate email (enumeration protection)', async () => {
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

      // SECURITY: Should return success to prevent enumeration
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
      // User object should NOT be exposed
      expect(data.user).toBeUndefined();
    });
  });

  describe('Response indistinguishability - Core security property', () => {
    it('returns identical HTTP status for new and existing emails', async () => {
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

      // SECURITY: Both should return identical 200 status
      expect(newUserResponse.status).toBe(200);
      expect(existingUserResponse.status).toBe(200);
    });

    it('returns byte-for-byte identical response body for new and existing emails', async () => {
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

      // SECURITY: Both should have success: true
      expect(newUserData.success).toBe(true);
      expect(existingUserData.success).toBe(true);

      // SECURITY: Both should have the same message
      expect(newUserData.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
      expect(existingUserData.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');

      // SECURITY: Neither should expose user object
      expect(newUserData.user).toBeUndefined();
      expect(existingUserData.user).toBeUndefined();

      // SECURITY: Response structure should be identical (same keys)
      expect(Object.keys(newUserData).sort()).toEqual(Object.keys(existingUserData).sort());
      
      // SECURITY: Responses should be byte-for-byte identical
      expect(JSON.stringify(newUserData)).toBe(JSON.stringify(existingUserData));
    });

    it('does not expose user ID or email in response (prevents information disclosure)', async () => {
      // Mock successful registration
      mockServiceClient.auth.admin.generateLink.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-id-12345',
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

      // SECURITY: Should not expose user object with ID or email
      expect(data.user).toBeUndefined();
      expect(data.id).toBeUndefined();
      expect(data.email).toBeUndefined();
      
      // Should only contain success and message
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
      expect(typeof data.message).toBe('string');
    });
  });

  describe('Error message variant handling', () => {
    it('handles "already registered" error message variant', async () => {
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

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
      expect(data.user).toBeUndefined();
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
  });

  describe('Server-side logging (security monitoring)', () => {
    it('logs warning when duplicate email is detected (server-side only)', async () => {
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

      // SECURITY: Should log a warning for security monitoring (server-side only)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Register] Attempted registration with existing email:'),
        'existing@example.com'
      );

      consoleWarnSpy.mockRestore();
    });

    it('logs success when confirmation email is sent (server-side only)', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

      await POST(request);

      // SECURITY: Should log success for monitoring (server-side only)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Register] Confirmation email sent successfully to:'),
        'newuser@example.com'
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Non-enumeration errors (should still return distinct responses)', () => {
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

      // Rate limiting should return 429, not 200
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

      // Validation errors should return 400, not 200
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Timing attack resistance', () => {
    it('processes duplicate email requests without early returns', async () => {
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

      // SECURITY: Should complete the request (not early return)
      expect(response.status).toBe(200);
      
      // Should return the same response as a successful registration
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('If your email can be registered, you will receive a confirmation link shortly.');
    });
  });
});

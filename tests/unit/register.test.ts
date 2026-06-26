import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registrationSchema } from '@/lib/validators';

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
        expect(result.error.errors[0].path).toContain('email');
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
        expect(result.error.errors[0].path).toContain('password');
        expect(result.error.errors[0].message).toContain('at least 8');
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
        expect(result.error.errors[0].path).toContain('password');
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
        expect(result.error.errors[0].path).toContain('display_name');
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

import { describe, it, expect } from 'vitest';
import {
  registrationSchema,
  overlordFormSchema,
  agentFormSchema,
  photoUploadSchema,
  photoListSchema,
  claimAnswersSchema,
  settingsSchema,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '@/lib/validators';

describe('registrationSchema', () => {
  it('accepts valid registration input', () => {
    const input = {
      email: 'agent@meowtrix.com',
      password: 'securepass123',
      display_name: 'TopInformant',
    };
    const result = registrationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const input = { email: 'not-an-email', password: 'securepass123', display_name: 'Agent' };
    const result = registrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const input = { email: 'a@b.com', password: 'short', display_name: 'Agent' };
    const result = registrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects password longer than 128 characters', () => {
    const input = { email: 'a@b.com', password: 'x'.repeat(129), display_name: 'Agent' };
    const result = registrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty display name', () => {
    const input = { email: 'a@b.com', password: 'securepass123', display_name: '' };
    const result = registrationSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('overlordFormSchema', () => {
  const validInput = {
    cat_name: 'Whiskers',
    description: 'Orange tabby with a scar on left ear',
    last_seen_lat: 13.7563,
    last_seen_lng: 100.5018,
    last_seen_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    verification_name: 'Whiskers',
    verification_marking: 'Scar on left ear',
    verification_trait: 'Purrs when belly is rubbed',
  };

  it('accepts valid overlord form input', () => {
    const result = overlordFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects cat name longer than 50 characters', () => {
    const result = overlordFormSchema.safeParse({ ...validInput, cat_name: 'A'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('rejects empty cat name', () => {
    const result = overlordFormSchema.safeParse({ ...validInput, cat_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects description longer than 500 characters', () => {
    const result = overlordFormSchema.safeParse({ ...validInput, description: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects future timestamp', () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const result = overlordFormSchema.safeParse({ ...validInput, last_seen_at: future });
    expect(result.success).toBe(false);
  });

  it('rejects timestamp more than 30 days ago', () => {
    const old = new Date(Date.now() - 31 * 86400000).toISOString(); // 31 days ago
    const result = overlordFormSchema.safeParse({ ...validInput, last_seen_at: old });
    expect(result.success).toBe(false);
  });

  it('rejects empty verification fields', () => {
    const result = overlordFormSchema.safeParse({ ...validInput, verification_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects verification fields over 200 characters', () => {
    const result = overlordFormSchema.safeParse({
      ...validInput,
      verification_marking: 'X'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('agentFormSchema', () => {
  it('accepts valid agent form input', () => {
    const result = agentFormSchema.safeParse({
      description: 'Spotted near the park',
      sighting_lat: 13.75,
      sighting_lng: 100.50,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty description', () => {
    const result = agentFormSchema.safeParse({
      description: '',
      sighting_lat: 13.75,
      sighting_lng: 100.50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects description over 500 characters', () => {
    const result = agentFormSchema.safeParse({
      description: 'A'.repeat(501),
      sighting_lat: 13.75,
      sighting_lng: 100.50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing location', () => {
    const result = agentFormSchema.safeParse({ description: 'test' });
    expect(result.success).toBe(false);
  });
});

describe('photoUploadSchema', () => {
  it('accepts valid JPEG file under 5MB', () => {
    const result = photoUploadSchema.safeParse({
      file: { size: 1024 * 1024, type: 'image/jpeg' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid PNG file', () => {
    const result = photoUploadSchema.safeParse({
      file: { size: 2 * 1024 * 1024, type: 'image/png' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid WebP file', () => {
    const result = photoUploadSchema.safeParse({
      file: { size: 500000, type: 'image/webp' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects file over 5MB', () => {
    const result = photoUploadSchema.safeParse({
      file: { size: MAX_IMAGE_SIZE_BYTES + 1, type: 'image/jpeg' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-image file type', () => {
    const result = photoUploadSchema.safeParse({
      file: { size: 1024, type: 'application/pdf' },
    });
    expect(result.success).toBe(false);
  });
});

describe('photoListSchema', () => {
  it('accepts 1-5 valid photos', () => {
    const photos = [
      { size: 1024, type: 'image/jpeg' },
      { size: 2048, type: 'image/png' },
    ];
    const result = photoListSchema.safeParse(photos);
    expect(result.success).toBe(true);
  });

  it('rejects empty photo list', () => {
    const result = photoListSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 photos', () => {
    const photos = Array.from({ length: 6 }, () => ({ size: 1024, type: 'image/jpeg' }));
    const result = photoListSchema.safeParse(photos);
    expect(result.success).toBe(false);
  });
});

describe('claimAnswersSchema', () => {
  it('accepts valid claim answers', () => {
    const result = claimAnswersSchema.safeParse({
      answer_name: 'Whiskers',
      answer_marking: 'Scar on ear',
      answer_trait: 'Likes belly rubs',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty answers', () => {
    const result = claimAnswersSchema.safeParse({
      answer_name: '',
      answer_marking: 'valid',
      answer_trait: 'valid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects answers over 200 characters', () => {
    const result = claimAnswersSchema.safeParse({
      answer_name: 'X'.repeat(201),
      answer_marking: 'valid',
      answer_trait: 'valid',
    });
    expect(result.success).toBe(false);
  });
});

describe('settingsSchema', () => {
  it('accepts consent enabled with coordinates', () => {
    const result = settingsSchema.safeParse({
      location_consent: true,
      residential_lat: 13.75,
      residential_lng: 100.50,
    });
    expect(result.success).toBe(true);
  });

  it('accepts consent disabled without coordinates', () => {
    const result = settingsSchema.safeParse({
      location_consent: false,
      residential_lat: null,
      residential_lng: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects consent enabled without coordinates', () => {
    const result = settingsSchema.safeParse({
      location_consent: true,
      residential_lat: null,
      residential_lng: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts consent disabled even with coordinates provided', () => {
    const result = settingsSchema.safeParse({
      location_consent: false,
      residential_lat: 13.75,
      residential_lng: 100.50,
    });
    expect(result.success).toBe(true);
  });
});

describe('constants', () => {
  it('exports accepted image types', () => {
    expect(ACCEPTED_IMAGE_TYPES).toContain('image/jpeg');
    expect(ACCEPTED_IMAGE_TYPES).toContain('image/png');
    expect(ACCEPTED_IMAGE_TYPES).toContain('image/webp');
    expect(ACCEPTED_IMAGE_TYPES).toHaveLength(3);
  });

  it('exports max image size as 5MB', () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});

// lib/validators.ts — Zod validation schemas for MEOWTRIX forms

import { z } from 'zod';

// --- Accepted image MIME types ---
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// --- Registration schema ---
export const registrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters'),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

// --- Lost Overlord form schema ---
export const overlordFormSchema = z.object({
  pet_name: z
    .string()
    .min(1, 'Pet name is required')
    .max(50, 'Pet name must be at most 50 characters'),
  pet_type: z.enum(['cat', 'dog'], { required_error: 'Pet type is required' }),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .default(''),
  last_seen_lat: z.number({ required_error: 'Last-seen location is required' }),
  last_seen_lng: z.number({ required_error: 'Last-seen location is required' }),
  last_seen_at: z
    .string()
    .refine(
      (val) => {
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: 'Invalid timestamp' }
    )
    .refine(
      (val) => {
        const date = new Date(val);
        return date <= new Date();
      },
      { message: 'Last-seen time cannot be in the future' }
    )
    .refine(
      (val) => {
        const date = new Date(val);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return date >= thirtyDaysAgo;
      },
      { message: 'Last-seen time cannot be more than 30 days ago' }
    ),
  verification_name: z
    .string()
    .min(1, 'Verification name is required')
    .max(200, 'Verification name must be at most 200 characters'),
  verification_marking: z
    .string()
    .min(1, 'Verification marking is required')
    .max(200, 'Verification marking must be at most 200 characters'),
  verification_trait: z
    .string()
    .min(1, 'Verification trait is required')
    .max(200, 'Verification trait must be at most 200 characters'),
});

export type OverlordFormInput = z.infer<typeof overlordFormSchema>;

// --- Spotted Agent form schema ---
export const agentFormSchema = z.object({
  pet_type: z.enum(['cat', 'dog'], { required_error: 'Pet type is required' }),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .default(''),
  sighting_lat: z.number({ required_error: 'Sighting location is required' }),
  sighting_lng: z.number({ required_error: 'Sighting location is required' }),
  sighted_at: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: 'Invalid timestamp' }
    )
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        return date <= new Date();
      },
      { message: 'Sighting time cannot be in the future' }
    )
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return date >= thirtyDaysAgo;
      },
      { message: 'Sighting time cannot be more than 30 days ago' }
    ),
});

export type AgentFormInput = z.infer<typeof agentFormSchema>;

// --- Photo upload validation schema ---
export const photoUploadSchema = z.object({
  file: z
    .object({
      size: z.number(),
      type: z.string(),
    })
    .refine((file) => file.size <= MAX_IMAGE_SIZE_BYTES, {
      message: 'File size must be 5MB or less',
    })
    .refine(
      (file) =>
        (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type),
      {
        message: 'Only JPEG, PNG, and WebP images are accepted',
      }
    ),
});

export const photoListSchema = z
  .array(photoUploadSchema.shape.file)
  .min(1, 'At least 1 photo is required')
  .max(5, 'Maximum 5 photos allowed');

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;

// --- Claim answers schema ---
export const claimAnswersSchema = z.object({
  answer_name: z
    .string()
    .min(1, 'Answer is required')
    .max(200, 'Answer must be at most 200 characters'),
  answer_marking: z
    .string()
    .min(1, 'Answer is required')
    .max(200, 'Answer must be at most 200 characters'),
  answer_trait: z
    .string()
    .min(1, 'Answer is required')
    .max(200, 'Answer must be at most 200 characters'),
});

export type ClaimAnswersInput = z.infer<typeof claimAnswersSchema>;

// --- Settings schema ---
export const settingsSchema = z.object({
  location_consent: z.boolean(),
  residential_lat: z.number().nullable().optional(),
  residential_lng: z.number().nullable().optional(),
}).refine(
  (data) => {
    // If consent is true, lat/lng must be provided
    if (data.location_consent) {
      return data.residential_lat != null && data.residential_lng != null;
    }
    return true;
  },
  {
    message: 'Location coordinates are required when location consent is enabled',
    path: ['residential_lat'],
  }
);

export type SettingsInput = z.infer<typeof settingsSchema>;

// --- Utility constants ---
export { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES };

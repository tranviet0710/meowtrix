// lib/stripVerificationFields.ts — Utility to remove verification fields from Overlord records

import type { Overlord } from '@/types';

/** The three verification fields that must never be exposed to non-owners */
export const VERIFICATION_FIELDS = [
  'verification_name',
  'verification_marking',
  'verification_trait',
] as const;

export type VerificationField = (typeof VERIFICATION_FIELDS)[number];

/**
 * Strip verification fields from an Overlord record.
 * Returns a new object without the verification fields.
 * All other fields are preserved unchanged.
 */
export function stripVerificationFields<T extends Record<string, unknown>>(
  overlord: T
): Omit<T, VerificationField> {
  const result = { ...overlord };
  for (const field of VERIFICATION_FIELDS) {
    delete (result as Record<string, unknown>)[field];
  }
  return result as Omit<T, VerificationField>;
}

/**
 * Determine whether verification fields should be included in the response.
 * Returns true only when the requesting user is the record owner.
 */
export function shouldExposeVerificationFields(
  requestingUserId: string,
  overlordOwnerId: string
): boolean {
  return requestingUserId === overlordOwnerId;
}

/**
 * Conditionally strip verification fields based on ownership.
 * - Owner: returns the full record (with verification fields)
 * - Non-owner: returns the record without verification fields
 */
export function prepareOverlordResponse(
  overlord: Record<string, unknown>,
  requestingUserId: string
): Record<string, unknown> {
  const ownerId = overlord.owner_id as string;
  if (shouldExposeVerificationFields(requestingUserId, ownerId)) {
    return overlord;
  }
  return stripVerificationFields(overlord);
}

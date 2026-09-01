// lib/claimVerification.ts — Pure verification logic for claim ownership

/**
 * Minimum characters required for an answer to be considered valid.
 * Prevents trivially short answers from passing verification.
 */
export const MIN_ANSWER_LENGTH = 3;

/**
 * Number of correct answers required out of 3 to pass verification.
 */
export const CORRECT_THRESHOLD = 2;

/**
 * Maximum failed attempts before lockout is triggered.
 */
export const MAX_FAILED_ATTEMPTS = 3;

/**
 * Lockout duration in milliseconds (24 hours).
 */
export const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Verifies a single claim answer against the stored value.
 * Uses case-insensitive exact matching with whitespace normalization.
 *
 * @param stored - The stored verification value from the Overlord record
 * @param submitted - The answer submitted by the claimant
 * @returns true if the submitted answer exactly matches the stored value (case-insensitive, trimmed)
 */
export function verifyAnswer(stored: string, submitted: string): boolean {
  if (submitted.length < MIN_ANSWER_LENGTH) return false;
  return stored.trim().toLowerCase() === submitted.trim().toLowerCase();
}

/**
 * Verifies all 3 claim answers and returns the count of correct answers.
 *
 * @param stored - Object with stored verification values
 * @param submitted - Object with submitted answers
 * @returns Number of correct answers (0-3)
 */
export function verifyClaimAnswers(
  stored: { name: string; marking: string; trait: string },
  submitted: { name: string; marking: string; trait: string }
): number {
  let correctCount = 0;
  if (verifyAnswer(stored.name, submitted.name)) correctCount++;
  if (verifyAnswer(stored.marking, submitted.marking)) correctCount++;
  if (verifyAnswer(stored.trait, submitted.trait)) correctCount++;
  return correctCount;
}

/**
 * Determines whether the claim passes verification based on correct answer count.
 *
 * @param correctCount - Number of correct answers
 * @returns true if the claim passes (≥ 2/3 correct)
 */
export function isClaimVerified(correctCount: number): boolean {
  return correctCount >= CORRECT_THRESHOLD;
}

/**
 * Determines whether a claimant is currently locked out.
 *
 * @param failedAttempts - Number of failed attempts for this overlord
 * @param lockedUntil - ISO timestamp of lockout expiry, or null if not locked
 * @returns true if the claimant is locked out
 */
export function isLockedOut(
  failedAttempts: number,
  lockedUntil: string | null
): boolean {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) return false;
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

/**
 * Calculates the lockout expiry timestamp when a lockout is triggered.
 *
 * @returns ISO string of the lockout expiry (24 hours from now)
 */
export function calculateLockoutExpiry(): string {
  return new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
}

/**
 * Determines whether a user is authorized to resolve (mark as "found") an Overlord.
 * Only the original reporting Informant (the Overlord owner) may resolve the Overlord.
 * No other Informant or administrator may mark the Overlord as resolved.
 *
 * @param userId - The ID of the user attempting to resolve the Overlord
 * @param overlordOwnerId - The owner_id of the Overlord record
 * @returns true if the user is authorized to resolve (userId matches overlordOwnerId)
 */
export function canResolveOverlord(userId: string, overlordOwnerId: string): boolean {
  return userId === overlordOwnerId;
}

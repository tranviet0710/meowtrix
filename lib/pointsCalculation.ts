/**
 * Points calculation for the Informant Leaderboard.
 *
 * Awards 10 points per verified claim as per Requirements 10.1.
 */

/** Points awarded per verified claim */
export const POINTS_PER_VERIFIED_CLAIM = 10;

/**
 * Calculate total points for an Informant based on number of verified claims.
 *
 * @param verifiedClaims — Number of claims that have been verified for the Informant
 * @returns Total points (always non-negative)
 */
export function calculatePoints(verifiedClaims: number): number {
  if (verifiedClaims < 0) {
    return 0;
  }
  return Math.floor(verifiedClaims) * POINTS_PER_VERIFIED_CLAIM;
}

/**
 * Route classification logic extracted from middleware.ts for testability.
 *
 * Determines whether a given path is protected (requires authentication)
 * or public (accessible without authentication).
 */

/** Paths that require an authenticated session */
export const PROTECTED_PATHS = [
  "/dashboard",
  "/report-lost",
  "/report-found",
  "/matches",
  "/leaderboard",
  "/profile",
  "/settings",
  "/overlords",
  "/agents",
] as const;

/** Public paths that should never redirect unauthenticated users */
export const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth",
] as const;

/**
 * Determines if a given pathname is a protected route.
 * A path is protected if it exactly matches or starts with any of the protected prefixes.
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Determines if a given pathname is a public route (never requires auth).
 * Public routes include login, register, and auth API endpoints.
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Builds the redirect URL for unauthenticated access to a protected route.
 * Returns the /login path with a `redirect` query param preserving the original path.
 */
export function buildAuthRedirectUrl(originalPath: string, baseUrl: string): URL {
  const redirectUrl = new URL("/login", baseUrl);
  redirectUrl.searchParams.set("redirect", originalPath);
  return redirectUrl;
}

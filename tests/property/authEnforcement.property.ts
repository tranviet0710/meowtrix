/**
 * Property-based tests for authentication enforcement (route protection).
 *
 * **Validates: Requirements 13.8**
 *
 * Req 13.8 (mapped from Req 1.8): When an unauthenticated visitor attempts to access
 * a protected route, the Tracker SHALL redirect to the sign-in page and preserve
 * the original path via a `redirect` query parameter.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isProtectedRoute,
  isPublicRoute,
  buildAuthRedirectUrl,
  PROTECTED_PATHS,
  PUBLIC_PATHS,
} from '@/lib/routeGuard';

// --- Generators ---

/** Generate a valid URL path segment (alphanumeric + hyphens, no leading slash) */
const pathSegmentArb = fc.stringOf(
  fc.oneof(
    fc.char().filter((c) => /[a-z0-9\-]/.test(c)),
    fc.constant('-')
  ),
  { minLength: 1, maxLength: 20 }
).filter((s) => s.length > 0 && !s.startsWith('-') && !s.endsWith('-'));

/** Generate a random sub-path suffix (e.g., "/abc123", "/some-id/detail") */
const subPathArb = fc.array(pathSegmentArb, { minLength: 1, maxLength: 3 })
  .map((segments) => '/' + segments.join('/'));

/** Generate a protected path with random sub-paths */
const protectedPathWithSubPathArb = fc.tuple(
  fc.constantFrom(...PROTECTED_PATHS),
  subPathArb
).map(([base, sub]) => `${base}${sub}`);

/** Generate an exact protected path */
const exactProtectedPathArb = fc.constantFrom(...PROTECTED_PATHS);

/** Generate a public path (login, register, api/auth) with optional sub-paths */
const publicPathArb = fc.oneof(
  fc.constantFrom(...PUBLIC_PATHS),
  fc.tuple(
    fc.constantFrom(...PUBLIC_PATHS),
    subPathArb
  ).map(([base, sub]) => `${base}${sub}`)
);

/** Generate a path that doesn't match any protected or public prefix */
const unrelatedPathArb = fc.constantFrom(
  '/',
  '/about',
  '/contact',
  '/api/overlords',
  '/api/agents',
  '/api/vision/process',
  '/api/matches',
  '/terms',
  '/privacy',
).chain((basePath) =>
  fc.oneof(
    fc.constant(basePath),
    subPathArb.map((sub) => `${basePath}${sub}`)
  )
).filter((path) => !PROTECTED_PATHS.some(
  (p) => path === p || path.startsWith(`${p}/`)
));

describe('Property 20: Authentication enforcement', () => {
  describe('Protected route detection', () => {
    it('any exact protected path should be classified as protected', () => {
      fc.assert(
        fc.property(exactProtectedPathArb, (path) => {
          expect(isProtectedRoute(path)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('any protected path with sub-paths should be classified as protected', () => {
      fc.assert(
        fc.property(protectedPathWithSubPathArb, (path) => {
          expect(isProtectedRoute(path)).toBe(true);
        }),
        { numRuns: 500 }
      );
    });

    it('protected paths with nested segments (e.g., /overlords/id/detail) should be protected', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PROTECTED_PATHS),
          pathSegmentArb,
          pathSegmentArb,
          (base, seg1, seg2) => {
            const deepPath = `${base}/${seg1}/${seg2}`;
            expect(isProtectedRoute(deepPath)).toBe(true);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Redirect URL construction', () => {
    it('redirect URL should always point to /login', () => {
      const baseUrl = 'http://localhost:3000';
      fc.assert(
        fc.property(
          fc.oneof(exactProtectedPathArb, protectedPathWithSubPathArb),
          (originalPath) => {
            const url = buildAuthRedirectUrl(originalPath, baseUrl);
            expect(url.pathname).toBe('/login');
          }
        ),
        { numRuns: 500 }
      );
    });

    it('redirect URL should include a redirect query param preserving the original path', () => {
      const baseUrl = 'http://localhost:3000';
      fc.assert(
        fc.property(
          fc.oneof(exactProtectedPathArb, protectedPathWithSubPathArb),
          (originalPath) => {
            const url = buildAuthRedirectUrl(originalPath, baseUrl);
            expect(url.searchParams.get('redirect')).toBe(originalPath);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Public routes are never redirected', () => {
    it('public routes (/login, /register, /api/auth/*) should be classified as public', () => {
      fc.assert(
        fc.property(publicPathArb, (path) => {
          expect(isPublicRoute(path)).toBe(true);
        }),
        { numRuns: 300 }
      );
    });

    it('public routes should NOT be classified as protected', () => {
      fc.assert(
        fc.property(publicPathArb, (path) => {
          expect(isProtectedRoute(path)).toBe(false);
        }),
        { numRuns: 300 }
      );
    });
  });

  describe('Unrelated paths are not protected', () => {
    it('paths not matching any protected prefix should not be classified as protected', () => {
      fc.assert(
        fc.property(unrelatedPathArb, (path) => {
          expect(isProtectedRoute(path)).toBe(false);
        }),
        { numRuns: 300 }
      );
    });
  });
});

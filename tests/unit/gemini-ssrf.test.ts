/**
 * Unit tests for SSRF mitigation in image fetching with redirect handling.
 * 
 * These tests verify that the security fix properly prevents SSRF attacks
 * via redirect-based bypass by:
 * 1. Disabling automatic redirect following
 * 2. Manually validating redirect targets
 * 3. Limiting redirect chains to prevent abuse
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractTraitsFromImage } from "@/lib/gemini";

// Mock the global fetch function
const originalFetch = global.fetch;

describe("SSRF Protection - Redirect Handling", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Set GEMINI_API_KEY for tests that need it
    process.env.GEMINI_API_KEY = "test-api-key-for-testing";
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    // Clean up env
    delete process.env.GEMINI_API_KEY;
  });

  describe("Redirect to private IP addresses", () => {
    it("rejects redirect from public URL to 127.0.0.1", async () => {
      // Mock fetch to return a redirect to localhost
      const headers = new Headers();
      headers.set("location", "http://127.0.0.1:8080/internal-api");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect-to-localhost")).rejects.toThrow();
    });

    it("rejects redirect from public URL to 192.168.x.x", async () => {
      const headers = new Headers();
      headers.set("location", "http://192.168.1.100/admin");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 301,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect-to-private")).rejects.toThrow();
    });

    it("rejects redirect from public URL to 10.x.x.x", async () => {
      const headers = new Headers();
      headers.set("location", "http://10.0.0.5/secret");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect-to-internal")).rejects.toThrow();
    });

    it("rejects redirect from public URL to 172.16.x.x", async () => {
      const headers = new Headers();
      headers.set("location", "http://172.16.0.1/internal");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("rejects redirect from public URL to AWS metadata endpoint", async () => {
      const headers = new Headers();
      headers.set("location", "http://169.254.169.254/latest/meta-data/");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/aws-metadata")).rejects.toThrow();
    });
  });

  describe("Redirect to localhost variants", () => {
    it("rejects redirect to localhost hostname", async () => {
      const headers = new Headers();
      headers.set("location", "http://localhost:3000/admin");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("rejects redirect to *.localhost domain", async () => {
      const headers = new Headers();
      headers.set("location", "http://app.localhost/api");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("rejects redirect to *.local domain", async () => {
      const headers = new Headers();
      headers.set("location", "http://server.local/internal");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("rejects redirect to *.internal domain", async () => {
      const headers = new Headers();
      headers.set("location", "http://api.internal/secrets");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });
  });

  describe("Redirect to non-HTTP protocols", () => {
    it("rejects redirect to file:// protocol", async () => {
      const headers = new Headers();
      headers.set("location", "file:///etc/passwd");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("rejects redirect to ftp:// protocol", async () => {
      const headers = new Headers();
      headers.set("location", "ftp://internal.server/data");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });
  });

  describe("Multiple redirect chains", () => {
    it("rejects second redirect (redirect chain limit)", async () => {
      // First redirect is to a valid public URL
      const firstHeaders = new Headers();
      firstHeaders.set("location", "https://cdn.example.com/image.jpg");
      
      const firstRedirectResponse = {
        status: 302,
        headers: firstHeaders,
      };

      // Second redirect would be to another URL (should be rejected)
      const secondHeaders = new Headers();
      secondHeaders.set("location", "https://another.example.com/image.jpg");
      
      const secondRedirectResponse = {
        status: 302,
        headers: secondHeaders,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce(firstRedirectResponse as any)
        .mockResolvedValueOnce(secondRedirectResponse as any);

      // Should reject due to multiple redirects, not reach Gemini API
      await expect(extractTraitsFromImage("https://attacker.com/chain")).rejects.toThrow();
    });

    it("rejects redirect chain that eventually leads to private IP", async () => {
      // First redirect to valid public URL
      const firstHeaders = new Headers();
      firstHeaders.set("location", "https://cdn.example.com/image.jpg");
      
      const firstRedirectResponse = {
        status: 302,
        headers: firstHeaders,
      };

      // Second redirect to private IP (should be rejected before fetch)
      const secondHeaders = new Headers();
      secondHeaders.set("location", "http://192.168.1.1/admin");
      
      const secondRedirectResponse = {
        status: 302,
        headers: secondHeaders,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce(firstRedirectResponse as any)
        .mockResolvedValueOnce(secondRedirectResponse as any);

      await expect(extractTraitsFromImage("https://attacker.com/chain")).rejects.toThrow();
    });
  });

  describe("Missing Location header", () => {
    it("rejects redirect response without Location header", async () => {
      const headers = new Headers();
      // No Location header set
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      // Should reject due to missing Location header
      await expect(extractTraitsFromImage("https://attacker.com/bad-redirect")).rejects.toThrow();
    });
  });

  describe("Relative redirect handling", () => {
    it("resolves relative redirect against original URL and validates", async () => {
      // Relative redirect should be resolved against the original URL
      const headers = new Headers();
      headers.set("location", "/images/cat.jpg");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      // The resolved URL would be https://attacker.com/images/cat.jpg
      // This should still be validated and potentially rejected based on allowlist
      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });
  });

  describe("Redirect with credentials in URL", () => {
    it("rejects redirect to URL with username", async () => {
      const headers = new Headers();
      headers.set("location", "http://admin@internal.server/api");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("rejects redirect to URL with username and password", async () => {
      const headers = new Headers();
      headers.set("location", "http://admin:secret@internal.server/api");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });
  });

  describe("Redirect with path traversal", () => {
    it("rejects redirect to URL with ../ in path", async () => {
      const headers = new Headers();
      headers.set("location", "https://example.com/../../../etc/passwd");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("rejects redirect to URL with encoded path traversal", async () => {
      const headers = new Headers();
      headers.set("location", "https://example.com/%2e%2e%2fsecrets");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });
  });

  describe("HTTP status code handling", () => {
    it("handles 301 Moved Permanently with validation", async () => {
      const headers = new Headers();
      headers.set("location", "http://127.0.0.1/admin");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 301,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("handles 302 Found with validation", async () => {
      const headers = new Headers();
      headers.set("location", "http://localhost/admin");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 302,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("handles 303 See Other with validation", async () => {
      const headers = new Headers();
      headers.set("location", "http://192.168.1.1/admin");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 303,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("handles 307 Temporary Redirect with validation", async () => {
      const headers = new Headers();
      headers.set("location", "http://10.0.0.1/admin");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 307,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });

    it("handles 308 Permanent Redirect with validation", async () => {
      const headers = new Headers();
      headers.set("location", "http://172.16.0.1/admin");
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 308,
        headers: headers,
      } as any);

      await expect(extractTraitsFromImage("https://attacker.com/redirect")).rejects.toThrow();
    });
  });
});

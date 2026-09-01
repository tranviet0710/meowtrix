import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates and sanitizes a redirect path to prevent open redirect vulnerabilities.
 * Only allows internal absolute paths (e.g., "/dashboard", "/matches").
 * Rejects external URLs, protocol-relative URLs, and other potentially unsafe values.
 * 
 * @param redirectParam - The redirect parameter from user input (query string, etc.)
 * @param defaultPath - The default path to return if validation fails (default: "/dashboard")
 * @returns A safe internal path
 */
export function getSafeRedirectPath(redirectParam: string | null, defaultPath = "/dashboard"): string {
  if (!redirectParam) {
    return defaultPath;
  }

  // Only allow internal absolute paths (e.g. "/matches")
  // Reject protocol-relative URLs (e.g. "//attacker.example/poc")
  // Reject external URLs (e.g. "https://attacker.example/poc")
  if (!redirectParam.startsWith("/") || redirectParam.startsWith("//")) {
    return defaultPath;
  }

  return redirectParam;
}

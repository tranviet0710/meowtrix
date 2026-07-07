// lib/errorSanitizer.ts — Sanitize database errors before exposing to clients

import { PostgrestError } from "@supabase/supabase-js";

/**
 * Sanitizes Supabase/PostgREST error messages to prevent information disclosure.
 * 
 * Raw database errors can reveal:
 * - Database schema details (table names, column names, types)
 * - Constraint names and validation rules
 * - Internal implementation details
 * - PostgreSQL/PostgREST error codes and messages
 * 
 * This function logs the full error server-side for debugging while returning
 * a generic message to the client.
 * 
 * @param error - The Supabase/PostgREST error object
 * @param operation - A description of the operation that failed (e.g., "create Agent", "fetch Overlords")
 * @param logContext - Optional context string for server-side logging (e.g., "[Agent POST]")
 * @returns A sanitized error message safe to return to clients
 */
export function sanitizeDatabaseError(
  error: PostgrestError | null | undefined,
  operation: string,
  logContext?: string
): string {
  // If no error, return a generic unknown error message
  if (!error) {
    return `Failed to ${operation}`;
  }

  // Log the full error server-side for debugging
  const prefix = logContext ? `${logContext} ` : "";
  console.error(
    `${prefix}Database error during ${operation}:`,
    {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    }
  );

  // Return a generic error message to the client
  // Do NOT include error.message, error.code, error.details, or error.hint
  return `Failed to ${operation}`;
}

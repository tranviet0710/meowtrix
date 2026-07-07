// tests/unit/errorSanitizer.test.ts — Unit tests for database error sanitization

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sanitizeDatabaseError } from "@/lib/errorSanitizer";
import { PostgrestError } from "@supabase/supabase-js";

describe("sanitizeDatabaseError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.error to verify logging behavior
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns generic message when error is null", () => {
    const result = sanitizeDatabaseError(null, "create Agent");
    expect(result).toBe("Failed to create Agent");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("returns generic message when error is undefined", () => {
    const result = sanitizeDatabaseError(undefined, "update Overlord");
    expect(result).toBe("Failed to update Overlord");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("sanitizes database error and does not expose error.message", () => {
    const dbError: PostgrestError = {
      message: 'duplicate key value violates unique constraint "agents_pkey"',
      details: "Key (id)=(123) already exists.",
      hint: "Check your insert statement",
      code: "23505",
    };

    const result = sanitizeDatabaseError(dbError, "create Agent");

    // Should return generic message only
    expect(result).toBe("Failed to create Agent");
    
    // Should NOT contain any database-specific details
    expect(result).not.toContain("duplicate key");
    expect(result).not.toContain("constraint");
    expect(result).not.toContain("agents_pkey");
    expect(result).not.toContain("23505");
    expect(result).not.toContain(dbError.message);
    expect(result).not.toContain(dbError.details || "");
    expect(result).not.toContain(dbError.hint || "");
  });

  it("sanitizes type mismatch errors without exposing schema details", () => {
    const dbError: PostgrestError = {
      message: 'column "photos" is of type text[] but expression is of type integer',
      details: "You will need to rewrite or cast the expression.",
      hint: null,
      code: "42804",
    };

    const result = sanitizeDatabaseError(dbError, "create Agent", "[Agent POST]");

    // Should return generic message only
    expect(result).toBe("Failed to create Agent");
    
    // Should NOT expose column names, types, or PostgreSQL error codes
    expect(result).not.toContain("photos");
    expect(result).not.toContain("text[]");
    expect(result).not.toContain("integer");
    expect(result).not.toContain("42804");
    expect(result).not.toContain("column");
    expect(result).not.toContain("cast");
  });

  it("sanitizes constraint violation errors without exposing constraint names", () => {
    const dbError: PostgrestError = {
      message: 'null value in column "reporter_id" violates not-null constraint',
      details: 'Failing row contains (null, ...).',
      hint: null,
      code: "23502",
    };

    const result = sanitizeDatabaseError(dbError, "create Agent");

    // Should return generic message only
    expect(result).toBe("Failed to create Agent");
    
    // Should NOT expose constraint names or column names
    expect(result).not.toContain("reporter_id");
    expect(result).not.toContain("not-null");
    expect(result).not.toContain("constraint");
    expect(result).not.toContain("23502");
  });

  it("sanitizes foreign key violation errors without exposing table relationships", () => {
    const dbError: PostgrestError = {
      message: 'insert or update on table "agents" violates foreign key constraint "agents_reporter_id_fkey"',
      details: 'Key (reporter_id)=(invalid-uuid) is not present in table "users".',
      hint: null,
      code: "23503",
    };

    const result = sanitizeDatabaseError(dbError, "create Agent");

    // Should return generic message only
    expect(result).toBe("Failed to create Agent");
    
    // Should NOT expose table names, foreign key names, or relationships
    expect(result).not.toContain("agents");
    expect(result).not.toContain("users");
    expect(result).not.toContain("reporter_id");
    expect(result).not.toContain("agents_reporter_id_fkey");
    expect(result).not.toContain("foreign key");
    expect(result).not.toContain("23503");
  });

  it("logs full error details server-side for debugging", () => {
    const dbError: PostgrestError = {
      message: "Database error with sensitive details",
      details: "Sensitive detail information",
      hint: "Helpful hint for developers",
      code: "ERRCODE",
    };

    sanitizeDatabaseError(dbError, "create Agent", "[Agent POST]");

    // Should log the full error server-side
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Agent POST] Database error during create Agent:",
      {
        message: "Database error with sensitive details",
        code: "ERRCODE",
        details: "Sensitive detail information",
        hint: "Helpful hint for developers",
      }
    );
  });

  it("logs without context prefix when logContext is not provided", () => {
    const dbError: PostgrestError = {
      message: "Some error",
      details: null,
      hint: null,
      code: "ERR",
    };

    sanitizeDatabaseError(dbError, "fetch Overlords");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Database error during fetch Overlords:",
      {
        message: "Some error",
        code: "ERR",
        details: null,
        hint: null,
      }
    );
  });

  it("handles errors with missing optional fields", () => {
    const dbError: PostgrestError = {
      message: "Error message",
      details: null,
      hint: null,
      code: "CODE",
    };

    const result = sanitizeDatabaseError(dbError, "delete Agent");

    expect(result).toBe("Failed to delete Agent");
    expect(result).not.toContain("Error message");
  });

  it("sanitizes PostgREST permission errors without exposing RLS policies", () => {
    const dbError: PostgrestError = {
      message: 'new row violates row-level security policy for table "agents"',
      details: null,
      hint: null,
      code: "42501",
    };

    const result = sanitizeDatabaseError(dbError, "create Agent");

    // Should return generic message only
    expect(result).toBe("Failed to create Agent");
    
    // Should NOT expose RLS policy details or table names
    expect(result).not.toContain("row-level security");
    expect(result).not.toContain("policy");
    expect(result).not.toContain("agents");
    expect(result).not.toContain("42501");
  });

  it("sanitizes check constraint violation errors", () => {
    const dbError: PostgrestError = {
      message: 'new row for relation "agents" violates check constraint "agents_photos_check"',
      details: 'Failing row contains (...).',
      hint: null,
      code: "23514",
    };

    const result = sanitizeDatabaseError(dbError, "create Agent");

    // Should return generic message only
    expect(result).toBe("Failed to create Agent");
    
    // Should NOT expose check constraint names or table names
    expect(result).not.toContain("agents_photos_check");
    expect(result).not.toContain("check constraint");
    expect(result).not.toContain("23514");
  });

  it("uses operation string in generic error message", () => {
    const dbError: PostgrestError = {
      message: "Some database error",
      details: null,
      hint: null,
      code: "ERR",
    };

    const result1 = sanitizeDatabaseError(dbError, "create Agent");
    const result2 = sanitizeDatabaseError(dbError, "update Overlord");
    const result3 = sanitizeDatabaseError(dbError, "fetch leaderboard");

    expect(result1).toBe("Failed to create Agent");
    expect(result2).toBe("Failed to update Overlord");
    expect(result3).toBe("Failed to fetch leaderboard");
  });

  it("prevents information disclosure through array type errors", () => {
    // Simulates the pentest scenario where attacker sends invalid photos field
    const dbError: PostgrestError = {
      message: 'column "photos" is of type text[] but expression is of type jsonb',
      details: "The photos field expects an array of text values",
      hint: "Cast the value to the correct type",
      code: "42804",
    };

    const result = sanitizeDatabaseError(dbError, "create Agent", "[Agent POST]");

    // Should return only generic message
    expect(result).toBe("Failed to create Agent");
    
    // Should NOT reveal that photos is a text[] column
    expect(result).not.toContain("photos");
    expect(result).not.toContain("text[]");
    expect(result).not.toContain("jsonb");
    expect(result).not.toContain("array");
    
    // Should log full details server-side
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Agent POST] Database error during create Agent:",
      expect.objectContaining({
        message: expect.stringContaining("photos"),
        code: "42804",
      })
    );
  });
});

// tests/unit/claimVerification.test.ts — Unit tests for claim verification logic

import { describe, it, expect } from "vitest";
import {
  verifyAnswer,
  verifyClaimAnswers,
  isClaimVerified,
  isLockedOut,
  calculateLockoutExpiry,
  MIN_ANSWER_LENGTH,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from "@/lib/claimVerification";

describe("verifyAnswer", () => {
  it("returns true for exact case-insensitive match", () => {
    expect(verifyAnswer("Whiskers", "whiskers")).toBe(true);
    expect(verifyAnswer("whiskers", "WHISKERS")).toBe(true);
    expect(verifyAnswer("White spot on left ear", "White spot on left ear")).toBe(true);
  });

  it("returns true for exact match with whitespace normalization", () => {
    expect(verifyAnswer("  Whiskers  ", "Whiskers")).toBe(true);
    expect(verifyAnswer("Whiskers", "  whiskers  ")).toBe(true);
    expect(verifyAnswer("  White spot  ", "  white spot  ")).toBe(true);
  });

  it("returns false for substring matches (not exact)", () => {
    expect(verifyAnswer("White spot on left ear", "white spot")).toBe(false);
    expect(verifyAnswer("loves to chase laser pointers", "chase laser")).toBe(false);
    expect(verifyAnswer("Whiskers", "Whi")).toBe(false);
  });

  it("returns false for answer shorter than minimum length", () => {
    expect(verifyAnswer("Whiskers", "Wh")).toBe(false);
    expect(verifyAnswer("Whiskers", "ab")).toBe(false);
    expect(verifyAnswer("Whiskers", "")).toBe(false);
  });

  it("returns true for answer exactly at minimum length", () => {
    expect(verifyAnswer("Cat", "cat")).toBe(true);
    expect(verifyAnswer("Dog", "DOG")).toBe(true);
  });

  it("returns false when submitted does not match stored", () => {
    expect(verifyAnswer("Whiskers", "Fluffy")).toBe(false);
    expect(verifyAnswer("black spots", "white marks")).toBe(false);
  });

  it("performs case-insensitive comparison", () => {
    expect(verifyAnswer("FLUFFY TAIL", "fluffy tail")).toBe(true);
    expect(verifyAnswer("fluffy tail", "FLUFFY TAIL")).toBe(true);
  });
});

describe("verifyClaimAnswers", () => {
  const stored = {
    name: "Mr. Whiskers",
    marking: "White star on forehead",
    trait: "Loves belly rubs",
  };

  it("returns 3 when all answers are correct (exact match)", () => {
    const result = verifyClaimAnswers(stored, {
      name: "Mr. Whiskers",
      marking: "White star on forehead",
      trait: "Loves belly rubs",
    });
    expect(result).toBe(3);
  });

  it("returns 3 when all answers are correct (case-insensitive)", () => {
    const result = verifyClaimAnswers(stored, {
      name: "mr. whiskers",
      marking: "white star on forehead",
      trait: "loves belly rubs",
    });
    expect(result).toBe(3);
  });

  it("returns 2 when 2 out of 3 are correct", () => {
    const result = verifyClaimAnswers(stored, {
      name: "Mr. Whiskers",
      marking: "wrong answer here",
      trait: "Loves belly rubs",
    });
    expect(result).toBe(2);
  });

  it("returns 1 when only 1 is correct", () => {
    const result = verifyClaimAnswers(stored, {
      name: "mr. whiskers",
      marking: "wrong answer",
      trait: "wrong trait",
    });
    expect(result).toBe(1);
  });

  it("returns 0 when all answers are wrong", () => {
    const result = verifyClaimAnswers(stored, {
      name: "totally wrong",
      marking: "wrong answer",
      trait: "wrong trait",
    });
    expect(result).toBe(0);
  });

  it("returns 0 when all answers are too short", () => {
    const result = verifyClaimAnswers(stored, {
      name: "ab",
      marking: "xy",
      trait: "z",
    });
    expect(result).toBe(0);
  });

  it("returns 0 when answers are substrings (not exact matches)", () => {
    const result = verifyClaimAnswers(stored, {
      name: "Whiskers",  // Missing "Mr. "
      marking: "White star",  // Missing " on forehead"
      trait: "belly rubs",  // Missing "Loves "
    });
    expect(result).toBe(0);
  });
});

describe("isClaimVerified", () => {
  it("returns true for 2 or more correct", () => {
    expect(isClaimVerified(2)).toBe(true);
    expect(isClaimVerified(3)).toBe(true);
  });

  it("returns false for fewer than 2 correct", () => {
    expect(isClaimVerified(0)).toBe(false);
    expect(isClaimVerified(1)).toBe(false);
  });
});

describe("isLockedOut", () => {
  it("returns false when failed attempts below threshold", () => {
    expect(isLockedOut(0, null)).toBe(false);
    expect(isLockedOut(1, null)).toBe(false);
    expect(isLockedOut(2, null)).toBe(false);
  });

  it("returns false when lockout has expired", () => {
    const expired = new Date(Date.now() - 1000).toISOString();
    expect(isLockedOut(MAX_FAILED_ATTEMPTS, expired)).toBe(false);
  });

  it("returns true when locked and lockout not expired", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isLockedOut(MAX_FAILED_ATTEMPTS, future)).toBe(true);
  });

  it("returns false when failed attempts at threshold but no locked_until", () => {
    expect(isLockedOut(MAX_FAILED_ATTEMPTS, null)).toBe(false);
  });
});

describe("calculateLockoutExpiry", () => {
  it("returns a date approximately 24 hours in the future", () => {
    const before = Date.now();
    const expiry = calculateLockoutExpiry();
    const after = Date.now();

    const expiryTime = new Date(expiry).getTime();
    expect(expiryTime).toBeGreaterThanOrEqual(before + LOCKOUT_DURATION_MS);
    expect(expiryTime).toBeLessThanOrEqual(after + LOCKOUT_DURATION_MS);
  });

  it("returns a valid ISO string", () => {
    const expiry = calculateLockoutExpiry();
    expect(new Date(expiry).toISOString()).toBe(expiry);
  });
});

describe("constants", () => {
  it("MIN_ANSWER_LENGTH is 3", () => {
    expect(MIN_ANSWER_LENGTH).toBe(3);
  });

  it("MAX_FAILED_ATTEMPTS is 3", () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(3);
  });

  it("LOCKOUT_DURATION_MS is 24 hours", () => {
    expect(LOCKOUT_DURATION_MS).toBe(24 * 60 * 60 * 1000);
  });
});

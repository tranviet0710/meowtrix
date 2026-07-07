/**
 * Security tests for claim verification substring vulnerability mitigation.
 * 
 * **Pentest Finding:** Claim verification accepts partial substrings instead of exact answers
 * 
 * These tests verify that the vulnerability has been mitigated by ensuring:
 * 1. Substring matches (3+ chars) are rejected
 * 2. Only exact matches (case-insensitive, trimmed) are accepted
 * 3. The exploit scenarios from the pentest are blocked
 * 4. Security-relevant state transitions only occur with exact matches
 */

import { describe, it, expect } from "vitest";
import {
  verifyAnswer,
  verifyClaimAnswers,
  isClaimVerified,
} from "@/lib/claimVerification";

describe("Security: Substring vulnerability mitigation", () => {
  describe("verifyAnswer - substring attack prevention", () => {
    it("rejects 3-character substring of longer stored value", () => {
      // Pentest scenario: attacker submits "Whi" for "Whiskers"
      expect(verifyAnswer("Whiskers", "Whi")).toBe(false);
      expect(verifyAnswer("Mr. Fluffy", "Mr.")).toBe(false);
      expect(verifyAnswer("Tabby cat", "Tab")).toBe(false);
    });

    it("rejects mid-length substring of stored value", () => {
      // Pentest scenario: attacker submits "white spot" for "White spot on left ear"
      expect(verifyAnswer("White spot on left ear", "white spot")).toBe(false);
      expect(verifyAnswer("White spot on left ear", "spot on left")).toBe(false);
      expect(verifyAnswer("White spot on left ear", "on left ear")).toBe(false);
    });

    it("rejects substring from middle of stored value", () => {
      // Pentest scenario: attacker submits "chase laser" for "loves to chase laser pointers"
      expect(verifyAnswer("loves to chase laser pointers", "chase laser")).toBe(false);
      expect(verifyAnswer("loves to chase laser pointers", "to chase")).toBe(false);
      expect(verifyAnswer("loves to chase laser pointers", "laser pointers")).toBe(false);
    });

    it("rejects prefix substring (beginning of stored value)", () => {
      expect(verifyAnswer("Black and white stripes", "Black and white")).toBe(false);
      expect(verifyAnswer("Loves belly rubs", "Loves belly")).toBe(false);
      expect(verifyAnswer("Distinctive orange patch", "Distinctive")).toBe(false);
    });

    it("rejects suffix substring (end of stored value)", () => {
      expect(verifyAnswer("White star on forehead", "on forehead")).toBe(false);
      expect(verifyAnswer("Loves to play fetch", "play fetch")).toBe(false);
      expect(verifyAnswer("Very friendly personality", "personality")).toBe(false);
    });

    it("rejects case-insensitive substring matches", () => {
      // Ensure case variations don't bypass the exact match requirement
      expect(verifyAnswer("White spot on left ear", "WHITE SPOT")).toBe(false);
      expect(verifyAnswer("loves to chase laser pointers", "CHASE LASER")).toBe(false);
      expect(verifyAnswer("Mr. Whiskers", "WHISKERS")).toBe(false);
    });

    it("rejects substring with extra whitespace", () => {
      // Attacker might try whitespace manipulation
      expect(verifyAnswer("White spot on left ear", "  white spot  ")).toBe(false);
      expect(verifyAnswer("loves to chase laser", "  chase  ")).toBe(false);
    });

    it("accepts only exact matches (security boundary)", () => {
      // These should pass - exact matches are the security boundary
      expect(verifyAnswer("Whiskers", "Whiskers")).toBe(true);
      expect(verifyAnswer("White spot on left ear", "White spot on left ear")).toBe(true);
      expect(verifyAnswer("loves to chase laser pointers", "loves to chase laser pointers")).toBe(true);
      
      // Case-insensitive exact matches should pass
      expect(verifyAnswer("Whiskers", "whiskers")).toBe(true);
      expect(verifyAnswer("White spot on left ear", "WHITE SPOT ON LEFT EAR")).toBe(true);
      
      // Whitespace-normalized exact matches should pass
      expect(verifyAnswer("  Whiskers  ", "Whiskers")).toBe(true);
      expect(verifyAnswer("White spot", "  White spot  ")).toBe(true);
    });
  });

  describe("verifyClaimAnswers - full claim verification security", () => {
    const storedAnswers = {
      name: "Mr. Whiskers",
      marking: "White star on forehead",
      trait: "Loves belly rubs",
    };

    it("rejects claim when all answers are substrings (pentest exploit scenario)", () => {
      // This is the exact exploit: attacker submits valid substrings
      const attackAnswers = {
        name: "Whiskers",        // substring of "Mr. Whiskers"
        marking: "White star",   // substring of "White star on forehead"
        trait: "belly rubs",     // substring of "Loves belly rubs"
      };
      
      const correctCount = verifyClaimAnswers(storedAnswers, attackAnswers);
      expect(correctCount).toBe(0);
      expect(isClaimVerified(correctCount)).toBe(false);
    });

    it("rejects claim when 2/3 answers are substrings", () => {
      // Attacker gets one right, tries substrings for others
      const attackAnswers = {
        name: "Mr. Whiskers",    // exact match
        marking: "White star",   // substring
        trait: "belly rubs",     // substring
      };
      
      const correctCount = verifyClaimAnswers(storedAnswers, attackAnswers);
      expect(correctCount).toBe(1);
      expect(isClaimVerified(correctCount)).toBe(false);
    });

    it("rejects claim when 1/3 answer is substring", () => {
      // Attacker gets two right, tries substring for one
      const attackAnswers = {
        name: "Mr. Whiskers",              // exact match
        marking: "White star on forehead", // exact match
        trait: "belly rubs",               // substring
      };
      
      const correctCount = verifyClaimAnswers(storedAnswers, attackAnswers);
      expect(correctCount).toBe(2);
      // This would pass verification (2/3 threshold) but only because 2 are exact
      expect(isClaimVerified(correctCount)).toBe(true);
    });

    it("accepts claim only when all passing answers are exact matches", () => {
      // Legitimate owner provides exact matches
      const legitimateAnswers = {
        name: "mr. whiskers",              // exact, case-insensitive
        marking: "white star on forehead", // exact, case-insensitive
        trait: "loves belly rubs",         // exact, case-insensitive
      };
      
      const correctCount = verifyClaimAnswers(storedAnswers, legitimateAnswers);
      expect(correctCount).toBe(3);
      expect(isClaimVerified(correctCount)).toBe(true);
    });

    it("prevents verification bypass with mixed substring attacks", () => {
      // Various substring attack patterns
      const attackPatterns = [
        { name: "Mr.", marking: "White star on forehead", trait: "Loves belly rubs" },
        { name: "Whiskers", marking: "White star on forehead", trait: "Loves belly rubs" },
        { name: "Mr. Whiskers", marking: "star on forehead", trait: "Loves belly rubs" },
        { name: "Mr. Whiskers", marking: "White star", trait: "Loves belly rubs" },
        { name: "Mr. Whiskers", marking: "White star on forehead", trait: "Loves" },
        { name: "Mr. Whiskers", marking: "White star on forehead", trait: "belly rubs" },
      ];

      attackPatterns.forEach((attack, index) => {
        const correctCount = verifyClaimAnswers(storedAnswers, attack);
        // Each should have at most 2 correct (the exact matches)
        expect(correctCount).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("Security boundary: minimum length enforcement", () => {
    it("rejects very short substrings even if they match", () => {
      // Even if a 2-char substring matches, it should be rejected
      expect(verifyAnswer("Mr. Whiskers", "Mr")).toBe(false);
      expect(verifyAnswer("Whiskers", "Wh")).toBe(false);
      expect(verifyAnswer("Cat", "Ca")).toBe(false);
    });

    it("enforces minimum length on exact matches too", () => {
      // Minimum length applies to all answers
      expect(verifyAnswer("AB", "AB")).toBe(false);
      expect(verifyAnswer("X", "X")).toBe(false);
      expect(verifyAnswer("", "")).toBe(false);
    });

    it("accepts 3-character exact matches at security boundary", () => {
      // Exactly 3 characters should work if exact match
      expect(verifyAnswer("Cat", "Cat")).toBe(true);
      expect(verifyAnswer("Dog", "dog")).toBe(true);
      expect(verifyAnswer("ABC", "abc")).toBe(true);
    });
  });

  describe("Security: state transition protection", () => {
    it("prevents claim verification with substring-based correct_count", () => {
      // Simulate the security-sensitive state transition check
      const storedAnswers = {
        name: "Fluffy",
        marking: "Orange tabby stripes",
        trait: "Playful and energetic",
      };

      // Attacker submits substrings
      const attackAnswers = {
        name: "Flu",                    // substring
        marking: "Orange tabby",        // substring
        trait: "Playful",               // substring
      };

      const correctCount = verifyClaimAnswers(storedAnswers, attackAnswers);
      
      // Verify that the correct_count is 0 (no substrings accepted)
      expect(correctCount).toBe(0);
      
      // Verify that isClaimVerified returns false
      expect(isClaimVerified(correctCount)).toBe(false);
      
      // This prevents the security-sensitive state transition:
      // - status: "verified" would NOT be set
      // - notifications would NOT be sent
      // - points would NOT be awarded
    });

    it("allows claim verification only with exact matches", () => {
      const storedAnswers = {
        name: "Fluffy",
        marking: "Orange tabby stripes",
        trait: "Playful and energetic",
      };

      // Legitimate owner provides exact matches
      const legitimateAnswers = {
        name: "Fluffy",
        marking: "Orange tabby stripes",
        trait: "Playful and energetic",
      };

      const correctCount = verifyClaimAnswers(storedAnswers, legitimateAnswers);
      
      // Verify that the correct_count is 3
      expect(correctCount).toBe(3);
      
      // Verify that isClaimVerified returns true
      expect(isClaimVerified(correctCount)).toBe(true);
      
      // This allows the security-sensitive state transition:
      // - status: "verified" can be set
      // - notifications can be sent
      // - points can be awarded
    });
  });

  describe("Edge cases: potential bypass attempts", () => {
    it("rejects substring with unicode normalization attempts", () => {
      // Attacker might try unicode tricks
      expect(verifyAnswer("Café", "Caf")).toBe(false);
      expect(verifyAnswer("naïve", "nai")).toBe(false);
    });

    it("rejects substring with special characters", () => {
      expect(verifyAnswer("Mr. Whiskers!", "Mr. Whiskers")).toBe(false);
      expect(verifyAnswer("White (spot) on ear", "White (spot)")).toBe(false);
      expect(verifyAnswer("Loves-to-play", "Loves-to")).toBe(false);
    });

    it("rejects empty or whitespace-only submissions", () => {
      expect(verifyAnswer("Whiskers", "")).toBe(false);
      expect(verifyAnswer("Whiskers", "   ")).toBe(false);
      expect(verifyAnswer("Whiskers", "\t\n")).toBe(false);
    });

    it("handles very long stored values correctly", () => {
      const longStored = "This is a very long description of a cat with many distinctive features and characteristics";
      
      // Substrings should be rejected
      expect(verifyAnswer(longStored, "This is a very long")).toBe(false);
      expect(verifyAnswer(longStored, "distinctive features")).toBe(false);
      
      // Only exact match should pass
      expect(verifyAnswer(longStored, longStored)).toBe(true);
    });

    it("handles stored values with multiple spaces correctly", () => {
      const storedWithSpaces = "White  spot  on  left  ear";
      
      // Substring should be rejected
      expect(verifyAnswer(storedWithSpaces, "White  spot")).toBe(false);
      
      // Exact match should pass (after trimming)
      expect(verifyAnswer(storedWithSpaces, "White  spot  on  left  ear")).toBe(true);
    });
  });

  describe("Regression: ensure old substring behavior is gone", () => {
    it("old behavior: includes() would have accepted these (now rejected)", () => {
      // These would have passed with the old .includes() logic
      const oldVulnerableAccepts = [
        { stored: "Whiskers", submitted: "Whi" },
        { stored: "White spot on left ear", submitted: "white spot" },
        { stored: "loves to chase laser pointers", submitted: "chase laser" },
        { stored: "Mr. Fluffy", submitted: "Fluffy" },
        { stored: "Black and white", submitted: "and" },
      ];

      oldVulnerableAccepts.forEach(({ stored, submitted }) => {
        // Verify old behavior is gone - these should all be false now
        expect(verifyAnswer(stored, submitted)).toBe(false);
      });
    });

    it("new behavior: exact matches are required", () => {
      // These should pass with the new exact-match logic
      const newSecureBehavior = [
        { stored: "Whiskers", submitted: "Whiskers" },
        { stored: "White spot on left ear", submitted: "White spot on left ear" },
        { stored: "loves to chase laser pointers", submitted: "loves to chase laser pointers" },
        { stored: "Mr. Fluffy", submitted: "Mr. Fluffy" },
        { stored: "Black and white", submitted: "Black and white" },
      ];

      newSecureBehavior.forEach(({ stored, submitted }) => {
        expect(verifyAnswer(stored, submitted)).toBe(true);
      });
    });
  });
});

import { describe, it, expect } from "vitest";
import { mergeTraitTags } from "@/lib/gemini";
import type { TraitTags } from "@/types";

function makeTraitTags(overrides: Partial<TraitTags> = {}): TraitTags {
  return {
    primary_color: "orange",
    secondary_color: null,
    pattern_type: "tabby",
    fur_length: "short",
    breed_estimate: "Domestic Shorthair",
    distinguishing_features: [],
    ...overrides,
  };
}

describe("mergeTraitTags", () => {
  describe("edge cases", () => {
    it("throws on empty array", () => {
      expect(() => mergeTraitTags([])).toThrow(
        "Cannot merge an empty array of TraitTags"
      );
    });

    it("returns the single element as-is for single-element array", () => {
      const tags = makeTraitTags({ primary_color: "black" });
      const result = mergeTraitTags([tags]);
      expect(result).toEqual(tags);
    });
  });

  describe("single-value fields — frequency-based selection", () => {
    it("selects the most frequent primary_color", () => {
      const result = mergeTraitTags([
        makeTraitTags({ primary_color: "orange" }),
        makeTraitTags({ primary_color: "black" }),
        makeTraitTags({ primary_color: "orange" }),
      ]);
      expect(result.primary_color).toBe("orange");
    });

    it("selects the most frequent pattern_type", () => {
      const result = mergeTraitTags([
        makeTraitTags({ pattern_type: "tabby" }),
        makeTraitTags({ pattern_type: "solid" }),
        makeTraitTags({ pattern_type: "tabby" }),
      ]);
      expect(result.pattern_type).toBe("tabby");
    });

    it("selects the most frequent fur_length", () => {
      const result = mergeTraitTags([
        makeTraitTags({ fur_length: "long" }),
        makeTraitTags({ fur_length: "short" }),
        makeTraitTags({ fur_length: "long" }),
      ]);
      expect(result.fur_length).toBe("long");
    });

    it("selects the most frequent breed_estimate", () => {
      const result = mergeTraitTags([
        makeTraitTags({ breed_estimate: "Siamese" }),
        makeTraitTags({ breed_estimate: "unknown" }),
        makeTraitTags({ breed_estimate: "Siamese" }),
      ]);
      expect(result.breed_estimate).toBe("Siamese");
    });

    it("selects the most frequent secondary_color including null", () => {
      const result = mergeTraitTags([
        makeTraitTags({ secondary_color: null }),
        makeTraitTags({ secondary_color: "white" }),
        makeTraitTags({ secondary_color: null }),
      ]);
      expect(result.secondary_color).toBeNull();
    });

    it("selects non-null secondary_color when it's most frequent", () => {
      const result = mergeTraitTags([
        makeTraitTags({ secondary_color: "white" }),
        makeTraitTags({ secondary_color: "white" }),
        makeTraitTags({ secondary_color: null }),
      ]);
      expect(result.secondary_color).toBe("white");
    });
  });

  describe("single-value fields — tie-breaking by recency", () => {
    it("breaks tie by selecting value from most recently uploaded photo", () => {
      // Equal frequency: "orange" at index 0, "black" at index 1
      // "black" is more recent → wins
      const result = mergeTraitTags([
        makeTraitTags({ primary_color: "orange" }),
        makeTraitTags({ primary_color: "black" }),
      ]);
      expect(result.primary_color).toBe("black");
    });

    it("breaks tie for pattern_type by recency", () => {
      const result = mergeTraitTags([
        makeTraitTags({ pattern_type: "tabby" }),
        makeTraitTags({ pattern_type: "solid" }),
      ]);
      expect(result.pattern_type).toBe("solid");
    });

    it("breaks tie with three-way split by most recent value", () => {
      // 3 distinct values, each appears once → last one wins
      const result = mergeTraitTags([
        makeTraitTags({ primary_color: "orange" }),
        makeTraitTags({ primary_color: "black" }),
        makeTraitTags({ primary_color: "white" }),
      ]);
      expect(result.primary_color).toBe("white");
    });

    it("frequency wins over recency when one value occurs more", () => {
      // "orange" appears 2x (indices 0,2), "black" appears 1x (index 1), "white" 1x (index 3)
      // orange wins by frequency even though white is more recent
      const result = mergeTraitTags([
        makeTraitTags({ primary_color: "orange" }),
        makeTraitTags({ primary_color: "black" }),
        makeTraitTags({ primary_color: "orange" }),
        makeTraitTags({ primary_color: "white" }),
      ]);
      expect(result.primary_color).toBe("orange");
    });
  });

  describe("distinguishing_features — combination and trimming", () => {
    it("combines unique features from all photos", () => {
      const result = mergeTraitTags([
        makeTraitTags({ distinguishing_features: ["green eyes", "striped tail"] }),
        makeTraitTags({ distinguishing_features: ["white paws", "large ears"] }),
      ]);
      expect(result.distinguishing_features).toHaveLength(4);
      expect(result.distinguishing_features).toContain("green eyes");
      expect(result.distinguishing_features).toContain("striped tail");
      expect(result.distinguishing_features).toContain("white paws");
      expect(result.distinguishing_features).toContain("large ears");
    });

    it("deduplicates features case-insensitively", () => {
      const result = mergeTraitTags([
        makeTraitTags({ distinguishing_features: ["Green Eyes", "striped tail"] }),
        makeTraitTags({ distinguishing_features: ["green eyes", "white paws"] }),
      ]);
      // "Green Eyes" and "green eyes" are the same feature
      const normalized = result.distinguishing_features.map((f) => f.toLowerCase());
      const unique = new Set(normalized);
      expect(unique.size).toBe(normalized.length);
    });

    it("trims to max 5 features by frequency", () => {
      const result = mergeTraitTags([
        makeTraitTags({
          distinguishing_features: ["green eyes", "striped tail", "white paws"],
        }),
        makeTraitTags({
          distinguishing_features: ["green eyes", "large ears", "round face"],
        }),
        makeTraitTags({
          distinguishing_features: ["green eyes", "striped tail", "bushy tail"],
        }),
      ]);
      expect(result.distinguishing_features.length).toBeLessThanOrEqual(5);
      // "green eyes" appears 3x, should be included
      expect(
        result.distinguishing_features.map((f) => f.toLowerCase())
      ).toContain("green eyes");
      // "striped tail" appears 2x, should be included
      expect(
        result.distinguishing_features.map((f) => f.toLowerCase())
      ).toContain("striped tail");
    });

    it("selects top 5 most frequent features when total exceeds 5", () => {
      const result = mergeTraitTags([
        makeTraitTags({
          distinguishing_features: ["a", "b", "c", "d", "e"],
        }),
        makeTraitTags({
          distinguishing_features: ["a", "b", "c", "f", "g"],
        }),
        makeTraitTags({
          distinguishing_features: ["a", "b", "h", "i", "j"],
        }),
      ]);
      // a=3, b=3, c=2, d=1, e=1, f=1, g=1, h=1, i=1, j=1
      expect(result.distinguishing_features).toHaveLength(5);
      const lowered = result.distinguishing_features.map((f) => f.toLowerCase());
      expect(lowered).toContain("a");
      expect(lowered).toContain("b");
      expect(lowered).toContain("c");
    });

    it("breaks feature frequency ties by most recent photo", () => {
      // Features "x" and "y" both appear once but in different photos
      // "y" is from a more recent photo → preferred
      const result = mergeTraitTags([
        makeTraitTags({
          distinguishing_features: ["a", "b", "c", "d", "x"],
        }),
        makeTraitTags({
          distinguishing_features: ["a", "b", "c", "d", "y"],
        }),
      ]);
      // a=2, b=2, c=2, d=2, x=1 (photo 0), y=1 (photo 1)
      // Top 5 selected: a, b, c, d have freq 2. Then y (more recent) over x
      expect(result.distinguishing_features).toHaveLength(5);
      const lowered = result.distinguishing_features.map((f) => f.toLowerCase());
      expect(lowered).toContain("y");
      expect(lowered).not.toContain("x");
    });

    it("returns empty array when all photos have no features", () => {
      const result = mergeTraitTags([
        makeTraitTags({ distinguishing_features: [] }),
        makeTraitTags({ distinguishing_features: [] }),
      ]);
      expect(result.distinguishing_features).toEqual([]);
    });
  });

  describe("all photos agree", () => {
    it("returns the agreed-upon value for all fields", () => {
      const tags = makeTraitTags({
        primary_color: "orange",
        secondary_color: "white",
        pattern_type: "tabby",
        fur_length: "short",
        breed_estimate: "Domestic Shorthair",
        distinguishing_features: ["green eyes"],
      });
      const result = mergeTraitTags([tags, tags, tags]);
      expect(result.primary_color).toBe("orange");
      expect(result.secondary_color).toBe("white");
      expect(result.pattern_type).toBe("tabby");
      expect(result.fur_length).toBe("short");
      expect(result.breed_estimate).toBe("Domestic Shorthair");
      expect(result.distinguishing_features).toEqual(["green eyes"]);
    });
  });
});

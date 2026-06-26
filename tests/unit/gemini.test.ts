import { describe, it, expect } from "vitest";
import { parseGeminiResponse } from "@/lib/gemini";

describe("parseGeminiResponse", () => {
  it("parses a valid complete JSON response", () => {
    const response = JSON.stringify({
      primary_color: "orange",
      secondary_color: "white",
      pattern_type: "tabby",
      fur_length: "short",
      breed_estimate: "Domestic Shorthair",
      distinguishing_features: ["green eyes", "striped tail", "white paws"],
    });

    const result = parseGeminiResponse(response);
    expect(result).toEqual({
      primary_color: "orange",
      secondary_color: "white",
      pattern_type: "tabby",
      fur_length: "short",
      breed_estimate: "Domestic Shorthair",
      distinguishing_features: ["green eyes", "striped tail", "white paws"],
    });
  });

  it("handles null secondary_color", () => {
    const response = JSON.stringify({
      primary_color: "black",
      secondary_color: null,
      pattern_type: "solid",
      fur_length: "long",
      breed_estimate: "unknown",
      distinguishing_features: ["yellow eyes"],
    });

    const result = parseGeminiResponse(response);
    expect(result).not.toBeNull();
    expect(result!.secondary_color).toBeNull();
  });

  it("strips markdown code block wrappers", () => {
    const response = `\`\`\`json
{
  "primary_color": "gray",
  "secondary_color": null,
  "pattern_type": "solid",
  "fur_length": "medium",
  "breed_estimate": "Russian Blue",
  "distinguishing_features": ["blue-gray coat", "green eyes"]
}
\`\`\``;

    const result = parseGeminiResponse(response);
    expect(result).not.toBeNull();
    expect(result!.primary_color).toBe("gray");
    expect(result!.breed_estimate).toBe("Russian Blue");
  });

  it("returns null when primary_color is missing", () => {
    const response = JSON.stringify({
      secondary_color: "white",
      pattern_type: "tabby",
      fur_length: "short",
      breed_estimate: "unknown",
      distinguishing_features: [],
    });

    expect(parseGeminiResponse(response)).toBeNull();
  });

  it("returns null when pattern_type is missing", () => {
    const response = JSON.stringify({
      primary_color: "orange",
      secondary_color: null,
      fur_length: "short",
      breed_estimate: "unknown",
      distinguishing_features: [],
    });

    expect(parseGeminiResponse(response)).toBeNull();
  });

  it("returns null when fur_length is missing", () => {
    const response = JSON.stringify({
      primary_color: "orange",
      secondary_color: null,
      pattern_type: "tabby",
      breed_estimate: "unknown",
      distinguishing_features: [],
    });

    expect(parseGeminiResponse(response)).toBeNull();
  });

  it("returns null for invalid pattern_type", () => {
    const response = JSON.stringify({
      primary_color: "orange",
      secondary_color: null,
      pattern_type: "spotted",
      fur_length: "short",
      breed_estimate: "unknown",
      distinguishing_features: [],
    });

    expect(parseGeminiResponse(response)).toBeNull();
  });

  it("returns null for invalid fur_length", () => {
    const response = JSON.stringify({
      primary_color: "orange",
      secondary_color: null,
      pattern_type: "tabby",
      fur_length: "extra-long",
      breed_estimate: "unknown",
      distinguishing_features: [],
    });

    expect(parseGeminiResponse(response)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseGeminiResponse("not json at all")).toBeNull();
    expect(parseGeminiResponse("{broken json")).toBeNull();
    expect(parseGeminiResponse("")).toBeNull();
  });

  it("trims distinguishing_features to max 5 items", () => {
    const response = JSON.stringify({
      primary_color: "orange",
      secondary_color: null,
      pattern_type: "tabby",
      fur_length: "short",
      breed_estimate: "unknown",
      distinguishing_features: [
        "green eyes",
        "striped tail",
        "white paws",
        "large ears",
        "round face",
        "long whiskers",
        "bushy tail",
      ],
    });

    const result = parseGeminiResponse(response);
    expect(result).not.toBeNull();
    expect(result!.distinguishing_features).toHaveLength(5);
  });

  it("filters out non-string and empty features", () => {
    const response = JSON.stringify({
      primary_color: "black",
      secondary_color: null,
      pattern_type: "solid",
      fur_length: "short",
      breed_estimate: "unknown",
      distinguishing_features: ["green eyes", "", 42, null, "  ", "short tail"],
    });

    const result = parseGeminiResponse(response);
    expect(result).not.toBeNull();
    expect(result!.distinguishing_features).toEqual(["green eyes", "short tail"]);
  });

  it("defaults breed_estimate to 'unknown' when missing", () => {
    const response = JSON.stringify({
      primary_color: "white",
      secondary_color: null,
      pattern_type: "solid",
      fur_length: "long",
      distinguishing_features: [],
    });

    const result = parseGeminiResponse(response);
    expect(result).not.toBeNull();
    expect(result!.breed_estimate).toBe("unknown");
  });

  it("handles case-insensitive pattern_type and fur_length", () => {
    const response = JSON.stringify({
      primary_color: "orange",
      secondary_color: null,
      pattern_type: "Tabby",
      fur_length: "Short",
      breed_estimate: "unknown",
      distinguishing_features: [],
    });

    const result = parseGeminiResponse(response);
    expect(result).not.toBeNull();
    expect(result!.pattern_type).toBe("tabby");
    expect(result!.fur_length).toBe("short");
  });

  it("handles missing distinguishing_features field gracefully", () => {
    const response = JSON.stringify({
      primary_color: "brown",
      secondary_color: "cream",
      pattern_type: "bicolor",
      fur_length: "medium",
      breed_estimate: "Siamese mix",
    });

    const result = parseGeminiResponse(response);
    expect(result).not.toBeNull();
    expect(result!.distinguishing_features).toEqual([]);
  });
});

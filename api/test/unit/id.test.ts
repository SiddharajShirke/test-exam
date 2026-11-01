import { describe, it, expect } from "vitest";
import { hashToken, generateSecureToken, isUUID, timingSafeEqual } from "../../src/lib/id.js";
import crypto from "crypto";

describe("hashToken", () => {
  it("returns consistent SHA-256 hex for same input", () => {
    const token = "test-token-value";
    const h1 = hashToken(token);
    const h2 = hashToken(token);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[0-9a-f]+$/);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken("abc")).not.toBe(hashToken("def"));
  });

  it("matches known SHA-256", () => {
    const expected = crypto.createHash("sha256").update("hello", "utf8").digest("hex");
    expect(hashToken("hello")).toBe(expected);
  });
});

describe("generateSecureToken", () => {
  it("returns a base64url string of approximately 43 chars", () => {
    const token = generateSecureToken();
    // 32 bytes base64url = ceil(32 * 4 / 3) = 43 chars (no padding)
    expect(token.length).toBeGreaterThanOrEqual(42);
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("returns unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("isUUID", () => {
  it("returns true for valid UUID v4", () => {
    // Version 1 UUID (should return false)
    expect(isUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
    // Non-v4 variant
    expect(isUUID("550e8400-e29b-41d4-2716-446655440000")).toBe(false);
    // Proper v4
    const v4 = crypto.randomUUID();
    expect(isUUID(v4)).toBe(true);
  });

  it("returns false for invalid UUIDs", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
    expect(isUUID("")).toBe(false);
    expect(isUUID("12345678-1234-1234-1234-123456789012")).toBe(false); // not v4
  });
});

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("hello", "hello")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeEqual("hello", "world")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(timingSafeEqual("", "a")).toBe(false);
  });
});


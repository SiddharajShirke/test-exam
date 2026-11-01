import crypto from "crypto";

/**
 * Generate a new UUID v4.
 */
export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Compute SHA-256 hex digest of input string.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Generate a cryptographically random 32-byte token as base64url.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Constant-time comparison of two strings (HMAC-based).
 * Both strings are hashed first to ensure equal lengths.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * Check if a string is a valid UUID v4 format.
 */
export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}


import { describe, it, expect } from "vitest";
import { logger, redact } from "../../src/lib/logger.js";

describe("logger redaction", () => {
  it("redacts password field", () => {
    const result = redact({ password: "secret123" });
    expect((result as Record<string, unknown>)["password"]).toBe("****");
  });

  it("redacts authorization header", () => {
    const result = redact({ authorization: "Bearer tok123" });
    expect((result as Record<string, unknown>)["authorization"]).toBe("****");
  });

  it("redacts cookie field", () => {
    const result = redact({ cookie: "sid=abc123" });
    expect((result as Record<string, unknown>)["cookie"]).toBe("****");
  });

  it("redacts x-platform-key field", () => {
    const result = redact({ "x-platform-key": "my-secret-key" });
    expect((result as Record<string, unknown>)["x-platform-key"]).toBe("****");
  });

  it("redacts token field", () => {
    const result = redact({ token: "rawtoken123" });
    expect((result as Record<string, unknown>)["token"]).toBe("****");
  });

  it("redacts token_hash field", () => {
    const result = redact({ token_hash: "sha256hashhere" });
    expect((result as Record<string, unknown>)["token_hash"]).toBe("****");
  });

  it("preserves non-sensitive fields", () => {
    const result = redact({ userId: "abc-123", status: "ok", count: 42 });
    const r = result as Record<string, unknown>;
    expect(r["userId"]).toBe("abc-123");
    expect(r["status"]).toBe("ok");
    expect(r["count"]).toBe(42);
  });

  it("redacts nested objects", () => {
    const result = redact({ user: { password: "secret", name: "Alice" } });
    const r = result as Record<string, unknown>;
    const user = r["user"] as Record<string, unknown>;
    expect(user["password"]).toBe("****");
    expect(user["name"]).toBe("Alice");
  });

  it("redacts in arrays", () => {
    const result = redact([{ password: "x" }, { name: "y" }]);
    const arr = result as Record<string, unknown>[];
    expect(arr[0]?.["password"]).toBe("****");
    expect(arr[1]?.["name"]).toBe("y");
  });

  it("redacts connection string patterns in string values", () => {
    const result = redact({ msg: "error: password=super_secret123 failed" });
    const r = result as Record<string, unknown>;
    expect(r["msg"]).not.toContain("super_secret");
  });
});

describe("logger output format", () => {
  it("exports a logger object with required methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });
});


/**
 * Contract test: GET /api/v1/health
 * Must return exactly { "status": "ok" } with x-app-version header.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { FakeAiProvider } from "../../src/providers/ai/fake.js";
import { FakeEmailProvider } from "../../src/providers/email/fake.js";
import type { Providers } from "../../src/providers/index.js";
import type { FilesProvider } from "../../src/providers/types.js";

// Minimal fake files provider
const fakeFiles: FilesProvider = {
  async saveJd() { return { path: "fake/path" }; },
  async getJd() { return Buffer.from(""); },
  async deleteJd() { },
};

const providers: Providers = {
  ai: new FakeAiProvider(),
  email: new FakeEmailProvider(),
  files: fakeFiles,
};

const app = createApp({ providers });

describe("GET /api/v1/health", () => {
  it("returns 200 with exactly { status: 'ok' }", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("sets x-app-version response header", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-app-version"]).toBeDefined();
  });

  it("echoes x-request-id if provided", async () => {
    const res = await request(app)
      .get("/api/v1/health")
      .set("x-request-id", "test-req-id-123");
    expect(res.headers["x-request-id"]).toBe("test-req-id-123");
  });

  it("generates x-request-id if not provided", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("unknown routes return 404 JSON", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});


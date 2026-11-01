/**
 * Middleware test: validate() and error handler.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { validate, errorHandler, asyncHandler } from "../../src/middleware/index.js";
import { AppError } from "../../src/lib/errors.js";

function buildApp() {
  const app = express();
  app.use(express.json());

  app.post(
    "/test-validate",
    validate(z.object({ name: z.string().min(1), age: z.number().int().min(0) })),
    (_req, res) => res.json({ ok: true })
  );

  app.get(
    "/test-apperror",
    asyncHandler(async () => {
      throw AppError.notFound("Thing not found");
    })
  );

  app.get(
    "/test-unknown-error",
    asyncHandler(async () => {
      throw new Error("Something broke internally");
    })
  );

  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe("validate middleware", () => {
  it("passes valid body through", async () => {
    const res = await request(app)
      .post("/test-validate")
      .send({ name: "Alice", age: 30 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 400 with VALIDATION_ERROR on invalid body", async () => {
    const res = await request(app)
      .post("/test-validate")
      .send({ name: "", age: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("returns 400 on missing required fields", async () => {
    const res = await request(app).post("/test-validate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("error handler", () => {
  it("serializes AppError correctly", async () => {
    const res = await request(app).get("/test-apperror");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Thing not found" },
    });
  });

  it("returns 500 INTERNAL for unknown errors and does not leak internals", async () => {
    const res = await request(app).get("/test-unknown-error");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
    expect(res.body.error.message).toBe("Internal server error");
    // Should not leak the raw error message
    expect(JSON.stringify(res.body)).not.toContain("Something broke internally");
  });
});


import { describe, it, expect } from "vitest";
import { AppError } from "../../src/lib/errors.js";

describe("AppError", () => {
  it("produces the standard error envelope", () => {
    const err = new AppError(400, "VALIDATION_ERROR", "Bad input", [
      { field: "email", message: "Invalid email" },
    ]);
    expect(err.toJSON()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Bad input",
        details: [{ field: "email", message: "Invalid email" }],
      },
    });
  });

  it("omits details when none provided", () => {
    const err = new AppError(404, "NOT_FOUND", "Not found");
    expect(err.toJSON()).toEqual({
      error: { code: "NOT_FOUND", message: "Not found" },
    });
  });

  it("factory methods set correct status and code", () => {
    expect(AppError.badRequest("x").status).toBe(400);
    expect(AppError.badRequest("x").code).toBe("VALIDATION_ERROR");

    expect(AppError.unauthenticated().status).toBe(401);
    expect(AppError.unauthenticated().code).toBe("UNAUTHENTICATED");

    expect(AppError.forbidden().status).toBe(403);
    expect(AppError.forbidden().code).toBe("FORBIDDEN");

    expect(AppError.notFound().status).toBe(404);
    expect(AppError.notFound().code).toBe("NOT_FOUND");

    expect(AppError.internal().status).toBe(500);
    expect(AppError.internal().code).toBe("INTERNAL");
  });

  it("conflict factory sets correct code", () => {
    const err = AppError.conflict("ATTEMPT_CLOSED", "Attempt is closed");
    expect(err.status).toBe(409);
    expect(err.code).toBe("ATTEMPT_CLOSED");
  });

  it("tooManyRequests factory sets status 429", () => {
    const err = AppError.tooManyRequests("RATE_LIMITED", "Too many requests");
    expect(err.status).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("is an instance of Error", () => {
    const err = AppError.notFound();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});


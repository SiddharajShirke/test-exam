import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

/**
 * Wrap an async route handler so thrown errors are forwarded to next().
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Zod validation middleware.
 * Validates req.body against the given schema.
 * On failure returns 400 VALIDATION_ERROR with zod field details.
 */
export function validate(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return next(AppError.badRequest("Validation failed", details));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate query parameters against the given schema.
 */
export function validateQuery(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return next(AppError.badRequest("Invalid query parameters", details));
    }
    req.query = result.data as Record<string, string>;
    next();
  };
}

/**
 * Global error handler middleware.
 * Produces the standard envelope: { error: { code, message, details? } }
 * Never leaks stack traces, SQL text, or secret values.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers["x-request-id"] as string | undefined;

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error("Application error", { code: err.code, status: err.status }, requestId);
    }

    // Add Retry-After header if present
    const errWithRetry = err as AppError & { retryAfter?: number };
    if (errWithRetry.retryAfter !== undefined) {
      res.setHeader("Retry-After", String(errWithRetry.retryAfter));
    }

    res.status(err.status).json(err.toJSON());
    return;
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details },
    });
    return;
  }

  // Unknown error — log it but never expose internals
  const errName = err instanceof Error ? err.name : "unknown";
  const errMsg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
  logger.error("Unhandled error", { name: errName, message: errMsg }, requestId);

  res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
}

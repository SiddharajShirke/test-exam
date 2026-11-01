import type { Request, Response, NextFunction } from "express";
import { newId } from "../lib/id";
import { logger } from "../lib/logger";

/**
 * Attaches a unique request-id to each request (or reuses an incoming one).
 * Echoes it back in the x-request-id response header.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? newId();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

/**
 * Structured access log middleware.
 * Logs: method, path (without query secrets), status, duration, tenantId when known.
 */
export function accessLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const requestId = req.headers["x-request-id"] as string | undefined;

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Strip sensitive query params from logged path
    const path = req.path;
    const tenantId =
      (req as Request & { tenantId?: string }).tenantId ??
      (res.locals?.tenantId as string | undefined);

    logger.info("request", {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: duration,
      requestId,
      ...(tenantId ? { tenantId } : {}),
    });
  });

  next();
}

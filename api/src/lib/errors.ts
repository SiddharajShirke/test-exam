/**
 * Application error class.
 * Every error response is:
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown[]
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    // Restore prototype chain (needed when compiling to ES5)
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize to the standard error envelope.
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && this.details.length > 0
          ? { details: this.details }
          : {}),
      },
    };
  }

  // --- Factory helpers ---

  static badRequest(message: string, details?: unknown[]): AppError {
    return new AppError(400, "VALIDATION_ERROR", message, details);
  }

  static unauthenticated(message = "Authentication required"): AppError {
    return new AppError(401, "UNAUTHENTICATED", message);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message);
  }

  static gone(code: string, message: string): AppError {
    return new AppError(410, code, message);
  }

  static unprocessable(code: string, message: string): AppError {
    return new AppError(422, code, message);
  }

  static tooManyRequests(code: string, message: string, retryAfter?: number): AppError {
    const err = new AppError(429, code, message);
    if (retryAfter !== undefined) {
      (err as AppError & { retryAfter: number }).retryAfter = retryAfter;
    }
    return err;
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError(500, "INTERNAL", message);
  }

  static serviceUnavailable(code: string, message: string): AppError {
    return new AppError(503, code, message);
  }
}


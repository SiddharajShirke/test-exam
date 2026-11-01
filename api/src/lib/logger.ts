/**
 * Structured JSON logger with request-id support and secret redaction.
 *
 * Redacted fields (case-insensitive key match):
 *   password, authorization, cookie, set-cookie, x-platform-key,
 *   token, foundry_key, connection string patterns, DATABASE_URL
 */

const REDACTED_KEYS = new Set([
  "password",
  "authorization",
  "cookie",
  "set-cookie",
  "x-platform-key",
  "token",
  "token_hash",
  "foundry_key",
  "foundry-key",
  "database_url",
  "acs_connection_string",
  "blob_connection_string",
  "session_secret",
  "platform_key",
  "sessionid",
]);

const REDACT_PATTERN =
  /(?:password|secret|key|token|connection.?string|authorization)=[^\s&]+/gi;

function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    const lk = key.toLowerCase().replace(/-/g, "_");
    if (REDACTED_KEYS.has(lk) || REDACTED_KEYS.has(key.toLowerCase())) {
      return "****";
    }
    // Redact patterns embedded in strings (like connection strings in error messages)
    return value.replace(REDACT_PATTERN, (m) => {
      const eqIdx = m.indexOf("=");
      return m.slice(0, eqIdx + 1) + "****";
    });
  }
  return value;
}

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 8) return obj;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((v) => redact(v, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = redactValue(k, typeof v === "object" ? redact(v, depth + 1) : v);
  }
  return result;
}

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(
  level: LogLevel,
  message: string,
  meta: Record<string, unknown> = {},
  requestId?: string
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    requestId,
    ...((redact(meta) as Record<string, unknown>) ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>, reqId?: string) =>
    log("debug", message, meta, reqId),
  info: (message: string, meta?: Record<string, unknown>, reqId?: string) =>
    log("info", message, meta, reqId),
  warn: (message: string, meta?: Record<string, unknown>, reqId?: string) =>
    log("warn", message, meta, reqId),
  error: (message: string, meta?: Record<string, unknown>, reqId?: string) =>
    log("error", message, meta, reqId),
};

export { redact };


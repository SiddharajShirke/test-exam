import sql from "mssql";
import { config } from "../config";
import { logger } from "../lib/logger";

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export const TRANSIENT_ERROR_NUMBERS = [
  4060, 40197, 40501, 40613, 49918, 49919, 49920, 10928, 10929, 10053, 10054, 10060,
];

export function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { number?: number; code?: string; originalError?: { info?: { number?: number } } };
  const num = anyErr.number ?? anyErr.originalError?.info?.number;
  if (num && TRANSIENT_ERROR_NUMBERS.includes(num)) {
    return true;
  }
  if (anyErr.code === "ETIMEOUT" || anyErr.code === "ESOCKET") {
    return true;
  }
  return false;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 200
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries || !isTransientError(err)) {
        throw err;
      }
      logger.warn(`Transient database error encountered. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`, {
        error: String(err instanceof Error ? err.message : err),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  throw new Error("executeWithRetry: unreachable");
}

export function parseConnectionString(connectionString: string): sql.config {
  // If it is standard ADO.NET format: Key=Value;Key2=Value2
  if (connectionString.includes("=")) {
    const parts = connectionString.split(";").filter((p) => p.trim().length > 0);
    const map = new Map<string, string>();
    for (const part of parts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx > 0) {
        const k = part.substring(0, eqIdx).trim().toLowerCase();
        const v = part.substring(eqIdx + 1).trim();
        map.set(k, v);
      }
    }

    const serverRaw = map.get("server") || map.get("data source") || "localhost";
    const serverClean = serverRaw.replace(/^tcp:/i, "");
    let server = serverClean;
    let port = 1433;
    if (serverClean.includes(",")) {
      const [s, p] = serverClean.split(",");
      server = s || "localhost";
      port = parseInt(p || "1433", 10) || 1433;
    }

    const database = map.get("database") || map.get("initial catalog") || "master";
    const user = map.get("user id") || map.get("uid") || map.get("user");
    const password = map.get("password") || map.get("pwd");

    const encryptStr = map.get("encrypt");
    const encrypt = encryptStr ? encryptStr.toLowerCase() === "true" : true;

    const trustCertStr = map.get("trustservercertificate");
    const trustServerCertificate = trustCertStr ? trustCertStr.toLowerCase() === "true" : false;

    const timeoutStr = map.get("connection timeout") || map.get("timeout");
    const connectionTimeout = timeoutStr ? parseInt(timeoutStr, 10) * 1000 : 30000;

    return {
      server,
      port,
      database,
      user,
      password,
      connectionTimeout,
      requestTimeout: 15000,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt,
        trustServerCertificate,
      },
    };
  }

  // Fallback for URI format or simple string
  return {
    connectionString,
    requestTimeout: 15000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  } as unknown as sql.config;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = (async () => {
    try {
      const dbConfig = parseConnectionString(config.DATABASE_URL);
      const newPool = new sql.ConnectionPool(dbConfig);
      await newPool.connect();
      pool = newPool;
      logger.info("Database connection pool established successfully.");
      return newPool;
    } catch (err) {
      poolPromise = null;
      logger.error("Failed to establish database connection pool", {
        error: String(err instanceof Error ? err.message : err),
      });
      throw err;
    }
  })();

  return poolPromise;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    poolPromise = null;
    logger.info("Database connection pool closed.");
  }
}

export async function withTransaction<T>(
  fn: (tx: sql.Transaction) => Promise<T>
): Promise<T> {
  const p = await getPool();
  const tx = new sql.Transaction(p);
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  const req = new sql.Request(tx);
  await req.batch("SET XACT_ABORT ON;");

  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // rollback could fail if connection was closed or transaction already rolled back
    }
    throw err;
  }
}

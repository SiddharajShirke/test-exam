import { describe, it, expect } from "vitest";
import { parseConnectionString, isTransientError, executeWithRetry } from "../../src/db/pool";
import { assertTenant } from "../../src/repositories/types";

describe("Database Pool & Connection String Parsing", () => {
  it("parses Azure SQL connection string (Encrypt=true, TrustServerCertificate=false)", () => {
    const cs =
      "Server=tcp:myserver.database.windows.net,1433;Database=assessdb;User ID=assess_app;Password=secret;Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;";
    const parsed = parseConnectionString(cs);

    expect(parsed.server).toBe("myserver.database.windows.net");
    expect(parsed.port).toBe(1433);
    expect(parsed.database).toBe("assessdb");
    expect(parsed.user).toBe("assess_app");
    expect(parsed.password).toBe("secret");
    expect(parsed.options?.encrypt).toBe(true);
    expect(parsed.options?.trustServerCertificate).toBe(false);
    expect(parsed.connectionTimeout).toBe(30000);
    expect(parsed.requestTimeout).toBe(15000);
    expect(parsed.pool?.max).toBe(10);
  });

  it("parses CI SQL container connection string (TrustServerCertificate=true)", () => {
    const cs =
      "Server=localhost,1433;Database=testdb;User ID=sa;Password=strong_password;Encrypt=true;TrustServerCertificate=true;";
    const parsed = parseConnectionString(cs);

    expect(parsed.server).toBe("localhost");
    expect(parsed.port).toBe(1433);
    expect(parsed.database).toBe("testdb");
    expect(parsed.options?.trustServerCertificate).toBe(true);
  });

  it("identifies transient error numbers correctly", () => {
    expect(isTransientError({ number: 4060 })).toBe(true);
    expect(isTransientError({ number: 40197 })).toBe(true);
    expect(isTransientError({ number: 10060 })).toBe(true);
    expect(isTransientError({ code: "ETIMEOUT" })).toBe(true);
    expect(isTransientError({ number: 50000 })).toBe(false);
    expect(isTransientError(new Error("Generic error"))).toBe(false);
  });

  it("executeWithRetry retries transient errors and succeeds", async () => {
    let callCount = 0;
    const op = async () => {
      callCount++;
      if (callCount < 3) {
        const err = new Error("Transient error");
        (err as { number: number }).number = 4060;
        throw err;
      }
      return "SUCCESS";
    };

    const result = await executeWithRetry(op, 3, 10);
    expect(result).toBe("SUCCESS");
    expect(callCount).toBe(3);
  });

  it("executeWithRetry fails immediately on non-transient error", async () => {
    let callCount = 0;
    const op = async () => {
      callCount++;
      throw new Error("Syntax error");
    };

    await expect(executeWithRetry(op, 3, 10)).rejects.toThrow("Syntax error");
    expect(callCount).toBe(1);
  });
});

describe("assertTenant helper", () => {
  it("accepts valid UUID v4", () => {
    expect(() => assertTenant("11111111-1111-4111-a111-111111111111")).not.toThrow();
  });

  it("throws on missing or non-UUID tenant id", () => {
    expect(() => assertTenant("")).toThrow(/tenantId required/);
    expect(() => assertTenant("invalid-id")).toThrow(/tenantId required/);
    expect(() => assertTenant(null as unknown as string)).toThrow(/tenantId required/);
  });
});

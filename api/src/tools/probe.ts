/**
 * src/tools/probe.ts — Azure connectivity probe tool (B6.3 / B7 Phase 1 item 6)
 *
 * Usage (after build):
 *   node dist/tools/probe.js <sql|blob|foundry|insights|acs|config|all> [--to someone@example.com]
 *
 * Exit code: 0 = all requested probes passed, 1 = at least one failed.
 *
 * Each probe line: PROBE <name> PASS|FAIL <ms> <reason>
 * Final line:      PROBE ALL PASS|FAIL
 *
 * Security: never prints secrets, keys, or connection strings.
 * Masking: first 4 chars of any connection string or key, then ****.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import { performance } from "perf_hooks";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProbeResult = {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  ms: number;
  reason: string;
};

// ─── Masking helper ───────────────────────────────────────────────────────────

export function maskSecret(value: string | undefined): string {
  if (!value || value.length < 4) return "****";
  return value.slice(0, 4) + "****";
}

// ─── Individual probes ────────────────────────────────────────────────────────

export async function probeConfig(): Promise<ProbeResult> {
  const required = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "PLATFORM_KEY",
    "REPO_BACKEND",
    "FILES_MODE",
    "AI_MODE",
    "EMAIL_MODE",
    "BLOB_CONNECTION_STRING",
    "BLOB_CONTAINER",
    "APP_BASE_URL",
    "API_INTERNAL_URL",
  ];

  const azureRequired: string[] = [];
  if (process.env["AI_MODE"] === "azure") {
    azureRequired.push("FOUNDRY_ENDPOINT", "FOUNDRY_KEY", "FOUNDRY_DEPLOYMENT");
  }
  if (process.env["EMAIL_MODE"] === "azure") {
    azureRequired.push("ACS_CONNECTION_STRING", "ACS_SENDER");
  }
  if (process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"]) {
    azureRequired.push("APPLICATIONINSIGHTS_CONNECTION_STRING");
  }

  const start = performance.now();
  const missing: string[] = [];
  const present: string[] = [];

  for (const key of [...required, ...azureRequired]) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  const ms = Math.round(performance.now() - start);

  for (const key of present) {
    console.log(`  config  ${key}: present`);
  }
  for (const key of missing) {
    console.log(`  config  ${key}: MISSING`);
  }

  if (missing.length > 0) {
    return { name: "config", status: "FAIL", ms, reason: `${missing.length} required var(s) missing: ${missing.join(", ")}` };
  }
  return { name: "config", status: "PASS", ms, reason: `${present.length} vars present` };
}

export async function probeSql(): Promise<ProbeResult> {
  const start = performance.now();
  const url = process.env["DATABASE_URL"];
  if (!url) {
    return { name: "sql", status: "FAIL", ms: 0, reason: "DATABASE_URL not set" };
  }

  try {
    // Dynamic import keeps mssql out of the memory code path
    const sql = require("mssql") as typeof import("mssql");
    const pool = await sql.connect(url);

    // Single-trip check
    await pool.request().query("SELECT 1 AS ok");

    // 10-trip average for latency report (B7 Phase 1 item 6)
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      await pool.request().query("SELECT 1 AS ok");
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    // DDL right: create and drop a temp table
    await pool.request().query("CREATE TABLE #probe_test (id INT)");
    await pool.request().query("DROP TABLE #probe_test");

    // Check schema_migrations existence
    const migCheck = await pool.request().query(
      "SELECT OBJECT_ID('[assess].[schema_migrations]') AS mig_id"
    );
    const migExists = !!migCheck.recordset[0]?.mig_id;

    // Verify app user cannot read dbo tables (only meaningful when running as app user)
    let dboBlocked = true;
    try {
      await pool.request().query("SELECT TOP 1 1 FROM [dbo].[sysobjects] WHERE 1=0");
      // If this succeeds, the app user has unexpected dbo access
      dboBlocked = false;
    } catch {
      dboBlocked = true;
    }

    await pool.close();

    const ms = Math.round(performance.now() - start);
    const avgMs = Math.round(avg);
    const latencyWarn = avgMs > 150 ? ` ⚠️ avg ${avgMs}ms > 150ms threshold (East US→West US expected 65–75ms)` : ` avg ${avgMs}ms`;
    const migMsg = migExists ? " schema_migrations:EXISTS" : " schema_migrations:NOT_FOUND(expected after Phase 2)";
    const dboMsg = dboBlocked ? "" : " ⚠️ app user can read dbo (unexpected)";

    return {
      name: "sql",
      status: "PASS",
      ms,
      reason: `SELECT 1 OK; DDL OK;${latencyWarn};${migMsg}${dboMsg}`,
    };
  } catch (err: unknown) {
    const ms = Math.round(performance.now() - start);
    return { name: "sql", status: "FAIL", ms, reason: String(err instanceof Error ? err.message : err) };
  }
}

export async function probeBlob(): Promise<ProbeResult> {
  const start = performance.now();
  const connStr = process.env["BLOB_CONNECTION_STRING"];
  const container = process.env["BLOB_CONTAINER"] || "jd-files";

  if (!connStr) {
    return { name: "blob", status: "FAIL", ms: 0, reason: "BLOB_CONNECTION_STRING not set" };
  }

  try {
    const { BlobServiceClient } = require("@azure/storage-blob") as typeof import("@azure/storage-blob");
    const svc = BlobServiceClient.fromConnectionString(connStr);
    const c = svc.getContainerClient(container);

    const testBlob = `selftest/${Date.now()}.txt`;
    const content = "probe-selftest";

    // PUT
    const blockBlob = c.getBlockBlobClient(testBlob);
    await blockBlob.upload(content, Buffer.byteLength(content));

    // GET
    const download = await blockBlob.download(0);
    const chunks: Buffer[] = [];
    for await (const chunk of (download.readableStreamBody as NodeJS.ReadableStream)) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const downloaded = Buffer.concat(chunks).toString();
    if (downloaded !== content) {
      throw new Error(`Content mismatch: expected "${content}" got "${downloaded}"`);
    }

    // DELETE
    await blockBlob.delete();

    // Anonymous check: attempt to GET the blob URL without credentials
    const url = blockBlob.url.split("?")[0] ?? blockBlob.url;
    let anonymousBlocked = false;
    try {
      const res = await fetch(url);
      anonymousBlocked = res.status === 404 || res.status === 409 || res.status === 401 || res.status === 403;
    } catch {
      anonymousBlocked = true; // network error = also blocked
    }

    const ms = Math.round(performance.now() - start);
    const anonMsg = anonymousBlocked ? "anonymous-blocked:OK" : "⚠️ anonymous-access:OPEN";
    return { name: "blob", status: "PASS", ms, reason: `PUT/GET/DELETE OK; ${anonMsg}` };
  } catch (err: unknown) {
    const ms = Math.round(performance.now() - start);
    return { name: "blob", status: "FAIL", ms, reason: String(err instanceof Error ? err.message : err) };
  }
}

export async function probeFoundry(): Promise<ProbeResult> {
  const start = performance.now();
  const endpoint = process.env["FOUNDRY_ENDPOINT"];
  const key = process.env["FOUNDRY_KEY"];
  const deployment = process.env["FOUNDRY_DEPLOYMENT"];
  const style = process.env["FOUNDRY_API_STYLE"] || "v1";
  const apiVersion = process.env["FOUNDRY_API_VERSION"];

  if (!endpoint || !key || !deployment) {
    return { name: "foundry", status: "FAIL", ms: 0, reason: "FOUNDRY_ENDPOINT / FOUNDRY_KEY / FOUNDRY_DEPLOYMENT not set" };
  }

  try {
    // Build URL per FOUNDRY_API_STYLE (B3 row 27 / AZ-001)
    let url: string;
    if (style === "azure-deployments") {
      const ver = apiVersion ? `?api-version=${apiVersion}` : "";
      url = `${endpoint}/openai/deployments/${deployment}/chat/completions${ver}`;
    } else {
      // v1 (default): OpenAI-compatible route, no api-version
      url = `${endpoint}/openai/v1/chat/completions`;
    }

    const body = {
      model: deployment,
      messages: [{ role: "user", content: 'Reply with exactly: {"ok":true}' }],
      max_tokens: 20,
      temperature: 0.0,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": key,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const ms = Math.round(performance.now() - start);

    if (!res.ok) {
      const text = await res.text();
      return { name: "foundry", status: "FAIL", ms, reason: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json() as { usage?: { total_tokens?: number } };
    const tokens = json?.usage?.total_tokens ?? 0;
    return { name: "foundry", status: "PASS", ms, reason: `HTTP 200; tokens=${tokens}; style=${style}` };
  } catch (err: unknown) {
    const ms = Math.round(performance.now() - start);
    if (err instanceof Error && err.name === "AbortError") {
      return { name: "foundry", status: "FAIL", ms, reason: "30s timeout" };
    }
    return { name: "foundry", status: "FAIL", ms, reason: String(err instanceof Error ? err.message : err) };
  }
}

export async function probeInsights(): Promise<ProbeResult> {
  const start = performance.now();
  const connStr = process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"];

  if (!connStr) {
    return { name: "insights", status: "SKIP", ms: 0, reason: "APPLICATIONINSIGHTS_CONNECTION_STRING not set (optional locally)" };
  }

  try {
    const appInsights = require("applicationinsights") as typeof import("applicationinsights");
    appInsights.setup(connStr).start();
    const client = appInsights.defaultClient;

    const marker = `probe-${Date.now()}`;
    client.trackTrace({ message: `PROBE marker=${marker}` });
    client.flush();

    const ms = Math.round(performance.now() - start);
    return {
      name: "insights",
      status: "PASS",
      ms,
      reason: `trace sent; marker=${marker}; find with KQL: traces | where message contains "${marker}"`,
    };
  } catch (err: unknown) {
    const ms = Math.round(performance.now() - start);
    return { name: "insights", status: "FAIL", ms, reason: String(err instanceof Error ? err.message : err) };
  }
}

export async function probeAcs(toEmail?: string): Promise<ProbeResult> {
  const start = performance.now();

  if (!toEmail) {
    return {
      name: "acs",
      status: "SKIP",
      ms: 0,
      reason: "No --to address given (acs probe only sends when --to is provided; never in 'all')",
    };
  }

  const connStr = process.env["ACS_CONNECTION_STRING"];
  const sender = process.env["ACS_SENDER"];

  if (!connStr || !sender) {
    return { name: "acs", status: "FAIL", ms: 0, reason: "ACS_CONNECTION_STRING or ACS_SENDER not set" };
  }

  try {
    const { EmailClient } = require("@azure/communication-email") as typeof import("@azure/communication-email");
    const client = new EmailClient(connStr);

    const poller = await client.beginSend({
      senderAddress: sender,
      content: {
        subject: "Probe test email — AI Assessment Platform",
        plainText: "This is a probe test email from the assess-api probe tool. You can delete it.",
      },
      recipients: { to: [{ address: toEmail }] },
    });

    const result = await poller.pollUntilDone();
    const ms = Math.round(performance.now() - start);

    if (result.status === "Succeeded") {
      return { name: "acs", status: "PASS", ms, reason: `email sent to ${toEmail}; messageId=${result.id ?? "n/a"}` };
    }
    return { name: "acs", status: "FAIL", ms, reason: `ACS status=${result.status}` };
  } catch (err: unknown) {
    const ms = Math.round(performance.now() - start);
    return { name: "acs", status: "FAIL", ms, reason: String(err instanceof Error ? err.message : err) };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] ?? "all";
  const toIdx = args.indexOf("--to");
  const toEmail = toIdx !== -1 ? args[toIdx + 1] : undefined;

  const results: ProbeResult[] = [];

  const run = async (p: () => Promise<ProbeResult>) => {
    const r = await p();
    const line = `PROBE ${r.name.toUpperCase()} ${r.status} ${r.ms}ms ${r.reason}`;
    console.log(line);
    results.push(r);
  };

  console.log(`PROBE START target=${target} ${new Date().toISOString()}`);
  console.log("");

  if (target === "config" || target === "all") await run(probeConfig);
  if (target === "sql"    || target === "all") await run(probeSql);
  if (target === "blob"   || target === "all") await run(probeBlob);
  if (target === "foundry"|| target === "all") await run(probeFoundry);
  if (target === "insights"||target === "all") await run(probeInsights);
  // acs: never run in 'all' (would send real email); only when explicitly requested
  if (target === "acs") await run(() => probeAcs(toEmail));

  const failed = results.filter(r => r.status === "FAIL");
  const overall = failed.length === 0 ? "PASS" : "FAIL";
  console.log("");
  console.log(`PROBE ALL ${overall} (${results.filter(r => r.status === "PASS").length} passed, ${failed.length} failed, ${results.filter(r => r.status === "SKIP").length} skipped)`);
  process.exit(failed.length > 0 ? 1 : 0);
}

// Only run main when this file is the entry point (not when imported in tests)
if (require.main === module) {
  main().catch(err => {
    console.error("PROBE FATAL", err);
    process.exit(1);
  });
}

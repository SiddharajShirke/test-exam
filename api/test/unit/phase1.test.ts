/**
 * test/unit/phase1.test.ts
 * Phase 1 Stage 1 unit tests:
 *   1. Forbidden-verb test: inventory.sh must not contain any state-changing
 *      az CLI verbs (B7 Phase 1 item 1).
 *   2. Sign-off gate test: provisioning scripts must refuse to write when
 *      PROVISIONING_PLAN.md does not contain "SIGN-OFF: APPROVED by"
 *      (B7 Phase 1 item 4).
 *   3. Probe unit tests: maskSecret, probeConfig (env-var checks).
 *
 * @t1
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { maskSecret, probeConfig } from "../../src/tools/probe";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── 1. Forbidden-verb test ──────────────────────────────────────────────────
describe("inventory.sh forbidden-verb check (B7 Phase 1 item 1)", () => {
  const inventoryPath = path.join(REPO_ROOT, "infra/azure/discovery/inventory.sh");

  it("inventory.sh exists", () => {
    expect(fs.existsSync(inventoryPath), `Expected ${inventoryPath} to exist`).toBe(true);
  });

  const FORBIDDEN_PATTERNS = [
    /az\s+\S+\s+keys\s+list/,
    /list-key\b/,
    /show-connection-string\b/,
    /get-shared-keys\b/,
    /az\s+keyvault\s+secret\s+show/,
    /az\s+\S+\s+exec\b/,
    /\baz\s+\S+\s+create\b/,
    /\baz\s+\S+\s+update\b/,
    /\baz\s+\S+\s+delete\b/,
    /\baz\s+\S+\s+set\b/,
  ];

  it.each(FORBIDDEN_PATTERNS)("does not contain forbidden verb pattern: %s", (pattern) => {
    const content = fs.readFileSync(inventoryPath, "utf8");
    // Strip comments (lines starting with #) before checking
    const withoutComments = content
      .split("\n")
      .filter(line => !line.trim().startsWith("#"))
      .join("\n");
    expect(
      pattern.test(withoutComments),
      `inventory.sh must not contain pattern "${pattern.source}".\nFound in file. Check for read-only violation.`
    ).toBe(false);
  });
});

// ── 2. Sign-off gate test ───────────────────────────────────────────────────
describe("_run.sh sign-off gate (B7 Phase 1 item 4)", () => {
  const runShPath = path.join(REPO_ROOT, "infra/azure/_run.sh");

  it("_run.sh exists", () => {
    expect(fs.existsSync(runShPath)).toBe(true);
  });

  it("_run.sh contains sign-off guard that checks PROVISIONING_PLAN.md", () => {
    const content = fs.readFileSync(runShPath, "utf8");
    // Must reference PROVISIONING_PLAN.md
    expect(content).toContain("PROVISIONING_PLAN.md");
    // Must check for the SIGN-OFF: APPROVED by pattern
    expect(content).toMatch(/SIGN-OFF: APPROVED by/);
    // Must exit 1 on missing sign-off
    expect(content).toMatch(/exit 1/);
  });

  it("each provisioning script sources _run.sh", () => {
    const scripts = ["10-core.sh", "20-sql.sh", "30-blob.sh", "40-ai.sh", "50-email.sh", "60-registry.sh", "70-assess-api.sh"];
    for (const script of scripts) {
      const scriptPath = path.join(REPO_ROOT, "infra/azure", script);
      if (!fs.existsSync(scriptPath)) {
        // Not yet created — skip gracefully
        continue;
      }
      const content = fs.readFileSync(scriptPath, "utf8");
      expect(content, `${script} must source _run.sh`).toMatch(/source.*_run\.sh/);
    }
  });

  it("PROVISIONING_PLAN.md exists and contains the SIGN-OFF: <not approved> placeholder", () => {
    const planPath = path.join(REPO_ROOT, "docs/PROVISIONING_PLAN.md");
    expect(fs.existsSync(planPath), "docs/PROVISIONING_PLAN.md must exist").toBe(true);
    const content = fs.readFileSync(planPath, "utf8");
    // The placeholder is present and not yet replaced
    expect(content).toContain("SIGN-OFF: <not approved>");
    // The APPROVED line must NOT be present yet
    expect(content).not.toMatch(/^SIGN-OFF: APPROVED by/m);
  });
});

// ── 3. Probe unit tests ─────────────────────────────────────────────────────
describe("probe.ts: maskSecret", () => {
  it("masks all but first 4 chars", () => {
    expect(maskSecret("abcdefgh")).toBe("abcd****");
  });

  it("masks short values entirely", () => {
    expect(maskSecret("abc")).toBe("****");
    expect(maskSecret("")).toBe("****");
    expect(maskSecret(undefined)).toBe("****");
  });
});

describe("probe.ts: probeConfig", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    // Minimal env for T1
    process.env["NODE_ENV"] = "test";
    process.env["REPO_BACKEND"] = "memory";
    process.env["FILES_MODE"] = "memory";
    process.env["AI_MODE"] = "fake";
    process.env["EMAIL_MODE"] = "fake";
    process.env["DATABASE_URL"] = "Server=localhost;Database=test;User ID=sa;Password=x;";
    process.env["SESSION_SECRET"] = "test-secret-at-least-32-chars-long-x";
    process.env["PLATFORM_KEY"] = "test-platform-at-least-32-chars-long-x";
    process.env["BLOB_CONNECTION_STRING"] = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=k;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";
    process.env["BLOB_CONTAINER"] = "jd-files";
    process.env["APP_BASE_URL"] = "http://localhost:8080";
    process.env["API_INTERNAL_URL"] = "http://localhost:8080";
    // Remove Azure-specific vars
    delete process.env["FOUNDRY_ENDPOINT"];
    delete process.env["FOUNDRY_KEY"];
    delete process.env["FOUNDRY_DEPLOYMENT"];
    delete process.env["ACS_CONNECTION_STRING"];
    delete process.env["ACS_SENDER"];
    delete process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"];
  });

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    Object.assign(process.env, origEnv);
  });

  it("PASS when all required vars are present (memory mode)", async () => {
    const result = await probeConfig();
    expect(result.status).toBe("PASS");
    expect(result.name).toBe("config");
  });

  it("FAIL when DATABASE_URL is missing", async () => {
    delete process.env["DATABASE_URL"];
    const result = await probeConfig();
    expect(result.status).toBe("FAIL");
    expect(result.reason).toContain("DATABASE_URL");
  });

  it("FAIL when SESSION_SECRET is missing", async () => {
    delete process.env["SESSION_SECRET"];
    const result = await probeConfig();
    expect(result.status).toBe("FAIL");
    expect(result.reason).toContain("SESSION_SECRET");
  });

  it("FAIL when AI_MODE=azure but FOUNDRY_ENDPOINT missing", async () => {
    process.env["AI_MODE"] = "azure";
    delete process.env["FOUNDRY_ENDPOINT"];
    const result = await probeConfig();
    expect(result.status).toBe("FAIL");
    expect(result.reason).toContain("FOUNDRY_ENDPOINT");
  });

  it("FAIL when EMAIL_MODE=azure but ACS_CONNECTION_STRING missing", async () => {
    process.env["EMAIL_MODE"] = "azure";
    delete process.env["ACS_CONNECTION_STRING"];
    const result = await probeConfig();
    expect(result.status).toBe("FAIL");
    expect(result.reason).toContain("ACS_CONNECTION_STRING");
  });
});

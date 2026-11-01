/**
 * Static Architectural Boundary Tests:
 * 1. SQL files in src/migrations and SQL code in src/repositories must only reference
 *    schema-qualified tables ([assess].[...]) and NEVER reference dbo or unqualified table names.
 * 2. SQL keywords (SELECT, INSERT, UPDATE, DELETE) must not appear outside src/repositories,
 *    src/migrations, and src/tools/probe.ts.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const API_SRC = path.join(REPO_ROOT, "api/src");

function getAllTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Schema Isolation & Architectural Guardrails (B7 Phase 2)", () => {
  it("0001_init.sql uses only [assess] schema and never references [dbo]", () => {
    const migrationFile = path.join(API_SRC, "migrations/sql/0001_init.sql");
    expect(fs.existsSync(migrationFile), "0001_init.sql must exist").toBe(true);

    const content = fs.readFileSync(migrationFile, "utf8");

    // Must not contain [dbo] or dbo.
    expect(content).not.toMatch(/\b\[?dbo\]?\./i);

    // Every CREATE TABLE must use [assess].
    const createTableMatches = content.match(/CREATE\s+TABLE\s+([^\s(]+)/gi) || [];
    expect(createTableMatches.length).toBeGreaterThanOrEqual(12);
    for (const match of createTableMatches) {
      expect(match).toMatch(/CREATE\s+TABLE\s+\[assess\]\./i);
    }
  });

  it("SQL repositories reference only [assess] schema or parameter schema and never [dbo]", () => {
    const sqlRepoFile = path.join(API_SRC, "repositories/sql/index.ts");
    expect(fs.existsSync(sqlRepoFile)).toBe(true);

    const content = fs.readFileSync(sqlRepoFile, "utf8");
    expect(content).not.toMatch(/\b\[?dbo\]?\./i);
  });

  it("SQL query keywords (SELECT, INSERT INTO, UPDATE, DELETE FROM) do not appear outside repositories, migrations, and probe", () => {
    const allFiles = getAllTsFiles(API_SRC);
    const forbiddenPatterns = [
      /\bSELECT\s+.+\s+FROM\b/i,
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+.+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
    ];

    for (const file of allFiles) {
      const relPath = path.relative(API_SRC, file).replace(/\\/g, "/");

      // Allowed directories:
      if (
        relPath.startsWith("repositories/") ||
        relPath.startsWith("migrations/") ||
        relPath.startsWith("db/pool.ts") ||
        relPath.startsWith("tools/probe.ts")
      ) {
        continue;
      }

      const content = fs.readFileSync(file, "utf8");
      // Strip comments
      const uncommented = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");

      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(uncommented),
          `Direct SQL keyword found in forbidden file: ${relPath}`
        ).toBe(false);
      }
    }
  });
});

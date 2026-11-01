/**
 * Lint rule test: importing pool outside repositories should fail ESLint.
 *
 * This test runs ESLint on a fixture file that imports the pool
 * from outside src/repositories and asserts ESLint exits non-zero.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

describe("ESLint no-restricted-imports rule", () => {
  it("fails when importing pool from outside repositories", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../fixtures/bad-import.ts"
    );

    let exitCode = 0;
    try {
      execSync(`npx eslint --no-eslintrc --rule "{\\"no-restricted-imports\\": [\\"error\\", {\\"patterns\\": [{\\"group\\": [\\"**/db/pool*\\"], \\"message\\": \\"Only repositories may import pool\\"}]}]}" ${fixturePath}`, {
        stdio: "pipe",
      });
    } catch (err: unknown) {
      // execSync throws when exit code != 0
      exitCode = (err as { status?: number }).status ?? 1;
    }
    expect(exitCode).toBeGreaterThan(0);
  });
});


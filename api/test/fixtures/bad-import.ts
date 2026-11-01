// This file intentionally imports from db/pool from outside repositories.
// It is used by the lint rule test to verify ESLint catches this violation.
// DO NOT USE THIS FILE IN PRODUCTION CODE.

// @ts-ignore - This import is intentionally invalid for testing purposes
import { pool } from "../db/pool";

export function badFunction() {
  return pool;
}


import * as fs from "fs";
import * as path from "path";
import sql from "mssql";
import { getPool, closePool } from "../db/pool";
import { config } from "../config";
import { logger } from "../lib/logger";

export async function runMigrations(): Promise<number> {
  const schema = config.DB_SCHEMA || "assess";
  logger.info(`Starting migration runner for schema [${schema}]...`);

  const pool = await getPool();

  // 1. Verify schema exists — fail fast if missing (B7 Phase 2 requirement)
  const schemaCheckReq = new sql.Request(pool);
  schemaCheckReq.input("schema", sql.NVarChar, schema);
  const schemaResult = await schemaCheckReq.query<{ schema_id: number }>(
    "SELECT schema_id FROM sys.schemas WHERE name = @schema;"
  );

  if (schemaResult.recordset.length === 0) {
    const errorMsg =
      `Schema [${schema}] does not exist in the target database. ` +
      "Per organizational constraints, the migration runner does not create schemas. " +
      "The dedicated schema and app user must be created via scripts/db/create-app-user.sql (OC-1B).";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Acquire sp_getapplock to prevent race conditions across container instances
  const lockReq = new sql.Request(pool);
  lockReq.input("Resource", sql.NVarChar, `${schema}-migrations`);
  lockReq.input("LockMode", sql.NVarChar, "Exclusive");
  lockReq.input("LockOwner", sql.NVarChar, "Session");
  lockReq.input("LockTimeout", sql.Int, 60000); // 60s
  lockReq.output("Result", sql.Int);

  const lockRes = await lockReq.execute<{ Result: number }>("sp_getapplock");
  const lockCode = lockRes.output["Result"];
  if (lockCode !== undefined && lockCode < 0) {
    throw new Error(`Failed to acquire migration lock for ${schema}-migrations (code ${lockCode})`);
  }

  logger.info(`Acquired migration lock for [${schema}].`);

  try {
    // 3. Ensure schema_migrations table exists inside the assess schema
    const initReq = new sql.Request(pool);
    await initReq.batch(`
      IF OBJECT_ID(N'[${schema}].[schema_migrations]', N'U') IS NULL
      BEGIN
          CREATE TABLE [${schema}].[schema_migrations] (
              [version] INT NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
              [name] NVARCHAR(255) NOT NULL,
              [applied_at] DATETIME2(3) NOT NULL CONSTRAINT DF_schema_migrations_applied_at DEFAULT SYSUTCDATETIME()
          );
      END;
    `);

    // 4. Query already applied migration versions
    const appliedReq = new sql.Request(pool);
    const appliedRes = await appliedReq.query<{ version: number }>(
      `SELECT [version] FROM [${schema}].[schema_migrations] ORDER BY [version] ASC;`
    );
    const appliedVersions = new Set(appliedRes.recordset.map((r) => r.version));

    // 5. Discover migration files
    const migrationsDir = path.join(__dirname, "sql");
    if (!fs.existsSync(migrationsDir)) {
      logger.warn(`Migrations SQL directory not found at ${migrationsDir}`);
      return 0;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;

      const version = parseInt(match[1]!, 10);
      const name = match[2]!;

      if (appliedVersions.has(version)) {
        continue;
      }

      logger.info(`Applying migration ${version}: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf8");

      // Execute in dedicated transaction
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      try {
        const txReq = new sql.Request(tx);
        await txReq.batch(sqlContent);

        const recordReq = new sql.Request(tx);
        recordReq.input("version", sql.Int, version);
        recordReq.input("name", sql.NVarChar, name);
        await recordReq.query(
          `INSERT INTO [${schema}].[schema_migrations] ([version], [name]) VALUES (@version, @name);`
        );

        await tx.commit();
        appliedCount++;
        logger.info(`Migration ${version} applied successfully.`);
      } catch (migrationErr) {
        try {
          await tx.rollback();
        } catch {
          // ignore rollback failure
        }
        logger.error(`Migration ${version} failed. Rolled back transaction.`, {
          error: String(migrationErr instanceof Error ? migrationErr.message : migrationErr),
        });
        throw migrationErr;
      }
    }

    logger.info(`Migration run complete. ${appliedCount} migration(s) applied.`);
    return appliedCount;
  } finally {
    // 6. Release application lock
    try {
      const releaseReq = new sql.Request(pool);
      releaseReq.input("Resource", sql.NVarChar, `${schema}-migrations`);
      releaseReq.input("LockOwner", sql.NVarChar, "Session");
      await releaseReq.execute("sp_releaseapplock");
      logger.info(`Released migration lock for [${schema}].`);
    } catch (releaseErr) {
      logger.warn("Failed to release migration lock cleanly", {
        error: String(releaseErr instanceof Error ? releaseErr.message : releaseErr),
      });
    }
  }
}

// CLI invocation support
if (require.main === module) {
  runMigrations()
    .then(async (count) => {
      console.log(`Migrations complete. Applied: ${count}`);
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Migration failed:", err);
      await closePool();
      process.exit(1);
    });
}

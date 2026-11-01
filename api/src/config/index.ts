import { z } from "zod";

const modeEnum = z.enum(["fake", "azure"]);
const filesModeEnum = z.enum(["azurite", "azure"]);

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),

  DATABASE_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(1),
  PLATFORM_KEY: z.string().min(1),

  AI_MODE: modeEnum.default("fake"),
  FOUNDRY_ENDPOINT: z.string().url().optional().or(z.literal("")),
  FOUNDRY_KEY: z.string().optional().or(z.literal("")),
  FOUNDRY_DEPLOYMENT: z.string().default("gpt-4o"),
  FOUNDRY_API_VERSION: z.string().default("2024-02-01"),

  EMAIL_MODE: modeEnum.default("fake"),
  ACS_CONNECTION_STRING: z.string().optional().or(z.literal("")),
  ACS_SENDER: z.string().optional().or(z.literal("")),

  FILES_MODE: filesModeEnum.default("azurite"),
  BLOB_CONNECTION_STRING: z.string().min(1),
  BLOB_CONTAINER: z.string().default("jd-files"),

  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional().or(z.literal("")),

  APP_BASE_URL: z.string().url().default("http://localhost:8080"),
  API_INTERNAL_URL: z.string().url().default("http://localhost:8080"),

  JOB_LOOP_ENABLED: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default("true"),

  GIT_SHA: z.string().default("local"),
  RETENTION_DAYS: z.coerce.number().int().min(1).optional(),
});

function validateConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.errors.map(
      (e) => `  ${e.path.join(".")}: ${e.message}`
    );
    console.error("Configuration error — missing or invalid environment variables:");
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }

  const cfg = parsed.data;
  const isProduction = cfg.NODE_ENV === "production";

  if (isProduction) {
    const productionErrors: string[] = [];

    if (cfg.AI_MODE !== "azure") {
      productionErrors.push("AI_MODE must be 'azure' in production");
    }
    if (cfg.EMAIL_MODE !== "azure") {
      productionErrors.push("EMAIL_MODE must be 'azure' in production");
    }
    if (cfg.FILES_MODE !== "azure") {
      productionErrors.push("FILES_MODE must be 'azure' in production");
    }
    if (cfg.SESSION_SECRET.length < 32) {
      productionErrors.push("SESSION_SECRET must be at least 32 characters in production");
    }
    if (cfg.PLATFORM_KEY.length < 32) {
      productionErrors.push("PLATFORM_KEY must be at least 32 characters in production");
    }

    if (productionErrors.length > 0) {
      console.error("Production configuration errors:");
      productionErrors.forEach((e) => console.error(`  ${e}`));
      process.exit(1);
    }
  }

  return cfg;
}

export type Config = ReturnType<typeof validateConfig>;
export const config = validateConfig();


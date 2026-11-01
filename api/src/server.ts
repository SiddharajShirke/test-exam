import http from "http";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";
import { createProviders } from "./providers/index.js";
import { runMigrations } from "./migrations/runner.js";

async function main() {
  logger.info("Starting api server", { nodeEnv: config.NODE_ENV, port: config.PORT });

  if (config.REPO_BACKEND === "sql") {
    logger.info("Running database migrations before listen...");
    await runMigrations();
  }

  const providers = createProviders(config);
  const app = createApp({ providers });

  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    logger.info("API server listening", { port: config.PORT, gitSha: config.GIT_SHA });
  });

  // Graceful shutdown on SIGTERM
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.warn("Graceful shutdown timeout, forcing exit");
      process.exit(1);
    }, 30_000);
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down");
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  logger.error("Fatal startup error", { message: String(err) });
  process.exit(1);
});


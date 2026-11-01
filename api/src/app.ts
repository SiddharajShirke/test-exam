import express, { type Application } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
import { requestIdMiddleware, accessLogMiddleware } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/index.js";
import { createHealthRouter } from "./routes/health.js";
import type { Providers } from "./providers/index.js";

export interface AppDeps {
  providers: Providers;
}

export function createApp(_deps: AppDeps): Application {
  const app = express();

  // Trust the first reverse proxy (Azure Container Apps)
  app.set("trust proxy", 1);

  // Security headers
  app.use(helmet());

  // Request ID + access logging
  app.use(requestIdMiddleware);
  app.use(accessLogMiddleware);

  // Body parsing (1 MB default)
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());

  // Routes
  const router = express.Router();
  router.use("/health", createHealthRouter(config));
  app.use("/api/v1", router);

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}


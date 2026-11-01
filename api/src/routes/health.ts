import { Router } from "express";
import type { Config } from "../config/index.js";

export function createHealthRouter(config: Config): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.setHeader("x-app-version", config.GIT_SHA);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ok" });
  });

  return router;
}


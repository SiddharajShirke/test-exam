import { config, Config } from "../config";
import { Clock, SystemClock } from "../lib/clock";
import { MemoryRepositories } from "./memory";
import { SqlRepositories } from "./sql";
import { Repositories } from "./types";

export * from "./types";
export * from "./system";
export { MemoryRepositories } from "./memory";
export { SqlRepositories } from "./sql";

export function createRepos(
  appConfig: Config = config,
  clock: Clock = new SystemClock()
): Repositories {
  if (appConfig.REPO_BACKEND === "memory") {
    if (appConfig.NODE_ENV === "production") {
      throw new Error("Memory repository backend cannot be used when NODE_ENV=production");
    }
    return new MemoryRepositories(clock);
  }

  return new SqlRepositories(clock, appConfig.DB_SCHEMA || "assess");
}

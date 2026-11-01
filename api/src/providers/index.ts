/**
 * Provider factory — creates the right provider implementations based on config.
 */
import type { Config } from "../config/index";
import type { AiProvider, EmailProvider, FilesProvider } from "./types";
import { FakeAiProvider } from "./ai/fake";
import { FakeEmailProvider } from "./email/fake";
import { AzureAiProvider } from "./ai/azure";
import { AzureEmailProvider } from "./email/azure";
import { AzureBlobFilesProvider } from "./files/azure";

export interface Providers {
  ai: AiProvider;
  email: EmailProvider;
  files: FilesProvider;
}

export function createProviders(config: Config): Providers {
  const ai: AiProvider = buildAiProvider(config);
  const email: EmailProvider = buildEmailProvider(config);
  const files: FilesProvider = buildFilesProvider(config);

  return { ai, email, files };
}

function buildAiProvider(config: Config): AiProvider {
  if (config.AI_MODE === "azure") {
    return new AzureAiProvider(config);
  }
  return new FakeAiProvider();
}

function buildEmailProvider(config: Config): EmailProvider {
  if (config.EMAIL_MODE === "azure") {
    return new AzureEmailProvider(config);
  }
  return new FakeEmailProvider();
}

function buildFilesProvider(config: Config): FilesProvider {
  return new AzureBlobFilesProvider(
    config.BLOB_CONNECTION_STRING,
    config.BLOB_CONTAINER
  );
}

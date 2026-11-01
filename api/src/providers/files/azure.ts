/**
 * Azurite / Azure Blob Storage files provider.
 * Used for local development (Azurite) and production (Azure Blob Storage).
 * The same @azure/storage-blob client works for both.
 */
import {
  BlobServiceClient,
  ContainerClient,
} from "@azure/storage-blob";
import type {
  FilesProvider,
  SaveJdInput,
} from "../types.js";
import { logger } from "../../lib/logger.js";

export class AzureBlobFilesProvider implements FilesProvider {
  private readonly containerClient: ContainerClient;

  constructor(connectionString: string, containerName: string) {
    const serviceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = serviceClient.getContainerClient(containerName);
  }

  async saveJd(input: SaveJdInput): Promise<{ path: string }> {
    const sanitized = sanitizeFileName(input.fileName);
    const path = `${input.tenantId}/${input.assessmentId}/${sanitized}`;
    const blobClient = this.containerClient.getBlockBlobClient(path);

    await blobClient.uploadData(input.content, {
      blobHTTPHeaders: { blobContentType: input.contentType },
    });

    logger.info("blob.saveJd", { path, size: input.content.length });
    return { path };
  }

  async getJd(path: string): Promise<Buffer> {
    const blobClient = this.containerClient.getBlockBlobClient(path);
    const response = await blobClient.downloadToBuffer();
    return response;
  }

  async deleteJd(path: string): Promise<void> {
    const blobClient = this.containerClient.getBlockBlobClient(path);
    await blobClient.deleteIfExists();
    logger.info("blob.deleteJd", { path });
  }
}

/**
 * Sanitise a filename for use as part of a blob path:
 * - Strip directory separators
 * - Remove control characters
 * - Collapse to at most 120 chars (keeping extension)
 */
function sanitizeFileName(name: string): string {
  // Remove directory traversal
  let safe = name.replace(/[/\\]/g, "_");
  // Remove control characters and null bytes
  // eslint-disable-next-line no-control-regex
  safe = safe.replace(/[\x00-\x1f\x7f]/g, "");
  // Trim to 120 chars while preserving the extension
  if (safe.length > 120) {
    const dotIdx = safe.lastIndexOf(".");
    if (dotIdx > 0) {
      const ext = safe.slice(dotIdx);
      safe = safe.slice(0, 120 - ext.length) + ext;
    } else {
      safe = safe.slice(0, 120);
    }
  }
  return safe || "file";
}


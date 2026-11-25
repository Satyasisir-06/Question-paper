import { Readable } from "node:stream";

export interface StorageProvider {
  putObject(key: string, data: Uint8Array | Buffer, contentType: string): Promise<void>;
  getObjectBuffer(key: string): Promise<Buffer>;
  getObjectStream(key: string): Promise<Readable>;
  moveObject(sourceKey: string, destinationKey: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** Validate storage key to block traversal, null bytes, and leading slashes. */
export function assertSafeStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.split("/").some((part) => part === ".." || part === "." || part === "")
  ) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return normalized;
}

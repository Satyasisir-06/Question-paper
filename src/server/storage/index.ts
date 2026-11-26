import { LocalStorageProvider } from "./localStorageProvider";
import { S3StorageProvider } from "./s3StorageProvider";
import type { StorageProvider } from "./storageProvider";
import { cleanEnvValue } from "@/lib/env";

const globalForStorage = globalThis as unknown as {
  __pvStorageProvider?: StorageProvider;
};

/** Resolve active StorageProvider singleton (local filesystem or S3/R2). */
export function getStorageProvider(): StorageProvider {
  if (globalForStorage.__pvStorageProvider) {
    return globalForStorage.__pvStorageProvider;
  }
  const provider =
    cleanEnvValue(process.env.STORAGE_PROVIDER) === "s3"
      ? new S3StorageProvider()
      : new LocalStorageProvider();
  globalForStorage.__pvStorageProvider = provider;
  return provider;
}

export type { StorageProvider };

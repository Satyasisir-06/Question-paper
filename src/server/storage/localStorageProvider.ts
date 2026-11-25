import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { assertSafeStorageKey, type StorageProvider } from "./storageProvider";

/** Disk-backed object storage adapter isolating quarantine/ and published/ prefixes. */
export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = path.resolve(
      /*turbopackIgnore: true*/ rootDir ?? process.env.LOCAL_STORAGE_DIR ?? "./storage"
    );
  }

  private resolveKeyPath(key: string): string {
    const safeKey = assertSafeStorageKey(key);
    const target = path.resolve(/*turbopackIgnore: true*/ this.rootDir, safeKey);
    const rel = path.relative(this.rootDir, target);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return target;
  }

  async putObject(
    key: string,
    data: Uint8Array | Buffer,
    _contentType?: string
  ): Promise<void> {
    void _contentType;
    const target = this.resolveKeyPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const target = this.resolveKeyPath(key);
    return fs.readFile(target);
  }

  async getObjectStream(key: string): Promise<Readable> {
    const target = this.resolveKeyPath(key);
    await fs.access(target);
    return createReadStream(target);
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<void> {
    const src = this.resolveKeyPath(sourceKey);
    const dst = this.resolveKeyPath(destinationKey);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    await fs.unlink(src);
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.resolveKeyPath(key);
    await fs.rm(target, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      const target = this.resolveKeyPath(key);
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }
}

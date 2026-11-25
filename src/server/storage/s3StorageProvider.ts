import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { assertSafeStorageKey, type StorageProvider } from "./storageProvider";

/** S3 / Cloudflare R2 object storage adapter for production deployments. */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when STORAGE_PROVIDER=s3."
      );
    }
    const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
    const forcePathStyle =
      process.env.S3_FORCE_PATH_STYLE === "true" ||
      Boolean(endpoint && /\.supabase\.(?:co|in)/i.test(endpoint));

    this.bucket = bucket;
    this.client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async putObject(
    key: string,
    data: Uint8Array | Buffer,
    contentType: string
  ): Promise<void> {
    const safeKey = assertSafeStorageKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
        Body: data,
        ContentType: contentType,
      })
    );
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const stream = await this.getObjectStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getObjectStream(key: string): Promise<Readable> {
    const safeKey = assertSafeStorageKey(key);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: safeKey })
    );
    if (!res.Body) {
      throw new Error(`Object not found: ${safeKey}`);
    }
    if (res.Body instanceof Readable) {
      return res.Body;
    }
    return Readable.fromWeb(
      res.Body.transformToWebStream() as unknown as import("node:stream/web").ReadableStream
    );
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<void> {
    const src = assertSafeStorageKey(sourceKey);
    const dst = assertSafeStorageKey(destinationKey);
    const encodedSrc = src.split("/").map(encodeURIComponent).join("/");
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodedSrc}`,
        Key: dst,
      })
    );
    await this.deleteObject(src);
  }

  async deleteObject(key: string): Promise<void> {
    const safeKey = assertSafeStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      const safeKey = assertSafeStorageKey(key);
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: safeKey })
      );
      return true;
    } catch {
      return false;
    }
  }
}

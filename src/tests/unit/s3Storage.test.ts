import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";

const { mockSend, ctorConfigs } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  ctorConfigs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = mockSend;
    constructor(config: Record<string, unknown>) {
      ctorConfigs.push(config);
    }
  }
  class PutObjectCommand {
    constructor(public input: unknown) {}
  }
  class GetObjectCommand {
    constructor(public input: unknown) {}
  }
  class CopyObjectCommand {
    constructor(public input: unknown) {}
  }
  class DeleteObjectCommand {
    constructor(public input: unknown) {}
  }
  class HeadObjectCommand {
    constructor(public input: unknown) {}
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
  };
});

import { S3StorageProvider } from "@/server/storage/s3StorageProvider";

describe("S3StorageProvider", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    ctorConfigs.length = 0;
    process.env.S3_BUCKET = "papervault-test";
    process.env.S3_REGION = "auto";
    process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.S3_ACCESS_KEY_ID = "test-access-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("requires bucket and credentials when initialized", () => {
    delete process.env.S3_BUCKET;
    expect(() => new S3StorageProvider()).toThrow(/S3_BUCKET/i);
  });

  it("uploads, streams, checks existence, and copies with unencoded path slashes", async () => {
    const provider = new S3StorageProvider();
    mockSend.mockResolvedValue({});

    await provider.putObject(
      "quarantine/file 1.pdf",
      new Uint8Array([0x25, 0x50]),
      "application/pdf"
    );
    expect(mockSend).toHaveBeenCalledTimes(1);

    await provider.moveObject("quarantine/file 1.pdf", "published/CSE/paper.pdf");
    const copyCall = mockSend.mock.calls[1]?.[0] as { input: { CopySource: string; Key: string } };
    expect(copyCall.input.CopySource).toBe("papervault-test/quarantine/file%201.pdf");
    expect(copyCall.input.CopySource).toContain("papervault-test/quarantine/");
    expect(copyCall.input.Key).toBe("published/CSE/paper.pdf");

    mockSend.mockResolvedValueOnce({
      Body: Readable.from([Buffer.from("pdf-bytes")]),
    });
    const buf = await provider.getObjectBuffer("published/CSE/paper.pdf");
    expect(buf.toString()).toBe("pdf-bytes");

    mockSend.mockResolvedValueOnce({});
    expect(await provider.exists("published/CSE/paper.pdf")).toBe(true);

    mockSend.mockRejectedValueOnce(new Error("NotFound"));
    expect(await provider.exists("published/CSE/missing.pdf")).toBe(false);
    expect(ctorConfigs[0]?.forcePathStyle).toBe(false);

    process.env.S3_ENDPOINT =
      "https://aeoabqclvusqdzktdcwj.storage.supabase.co/storage/v1/s3";
    new S3StorageProvider();
    expect(ctorConfigs[1]?.forcePathStyle).toBe(true);
  });
});

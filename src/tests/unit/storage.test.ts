import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalStorageProvider } from "@/server/storage/localStorageProvider";

const tempDirs: string[] = [];

async function makeTempStorage() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "papervault-storage-"));
  tempDirs.push(dir);
  return { dir, provider: new LocalStorageProvider(dir) };
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
});

describe("LocalStorageProvider", () => {
  it("stores quarantine object, retrieves bytes, and moves safely to published", async () => {
    const { provider } = await makeTempStorage();
    const payload = new TextEncoder().encode("%PDF-1.7 test content");

    await provider.putObject("quarantine/paper-1.pdf", payload, "application/pdf");
    expect(await provider.exists("quarantine/paper-1.pdf")).toBe(true);

    const readBack = await provider.getObjectBuffer("quarantine/paper-1.pdf");
    expect(new TextDecoder().decode(readBack)).toBe("%PDF-1.7 test content");

    await provider.moveObject(
      "quarantine/paper-1.pdf",
      "published/CSE/2-2/SUPPLY/CS401.pdf"
    );

    expect(await provider.exists("quarantine/paper-1.pdf")).toBe(false);
    expect(await provider.exists("published/CSE/2-2/SUPPLY/CS401.pdf")).toBe(true);

    await provider.deleteObject("published/CSE/2-2/SUPPLY/CS401.pdf");
    expect(await provider.exists("published/CSE/2-2/SUPPLY/CS401.pdf")).toBe(false);
  });

  it("blocks path traversal outside storage root", async () => {
    const { provider } = await makeTempStorage();
    const payload = new TextEncoder().encode("test");

    await expect(
      provider.putObject("../../outside.pdf", payload, "application/pdf")
    ).rejects.toThrow(/invalid storage key/i);

    await expect(provider.getObjectBuffer("../secret.txt")).rejects.toThrow(
      /invalid storage key/i
    );
  });
});

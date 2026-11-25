import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { closeDb, createInMemoryTestDb, getDb } from "@/server/db/client";
import { ensureCoreCatalog } from "@/server/db/seedData";
import { branches, subjects, users } from "@/server/db/schema";

describe("Database client singleton & bootstrap", () => {
  it("initializes local pglite persistence directory and closes cleanly", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "papervault-db-"));
    const prevUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `pglite://${path.join(tmp, "pgdata")}`;
    try {
      await closeDb();
      const db = await getDb();
      const rows = await db.select().from(branches);
      expect(Array.isArray(rows)).toBe(true);
    } finally {
      await closeDb();
      if (prevUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevUrl;
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 15_000);

  it("idempotently bootstraps core B.Tech catalog and configured admin on empty DB", async () => {
    const prevEmail = process.env.ADMIN_SEED_EMAIL;
    const prevPass = process.env.ADMIN_SEED_PASSWORD;
    process.env.ADMIN_SEED_EMAIL = "cell@college.edu";
    process.env.ADMIN_SEED_PASSWORD = "StrongPassword@2026";
    const { db, close } = await createInMemoryTestDb();
    try {
      await ensureCoreCatalog(db);
      await ensureCoreCatalog(db);

      const branchRows = await db.select().from(branches);
      const subjectRows = await db.select().from(subjects);
      const userRows = await db.select().from(users);

      expect(branchRows.length).toBe(9);
      expect(subjectRows.length).toBeGreaterThanOrEqual(19);
      expect(userRows.some((u) => u.email === "cell@college.edu")).toBe(true);
    } finally {
      await close();
      if (prevEmail === undefined) delete process.env.ADMIN_SEED_EMAIL;
      else process.env.ADMIN_SEED_EMAIL = prevEmail;
      if (prevPass === undefined) delete process.env.ADMIN_SEED_PASSWORD;
      else process.env.ADMIN_SEED_PASSWORD = prevPass;
    }
  }, 15_000);
});

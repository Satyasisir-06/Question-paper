import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createInMemoryTestDb, type AppDb } from "@/server/db/client";
import { seedDatabase, syncDefaultBranches } from "@/server/db/seedData";
import { branches, papers } from "@/server/db/schema";
import { LocalStorageProvider } from "@/server/storage/localStorageProvider";
import { PaperService } from "@/server/services/paperService";
import { ZipLimitError, ZipStreamService } from "@/server/services/zipStreamService";
import { CatalogService } from "@/server/services/catalogService";

let db: AppDb;
let closeDbFn: () => Promise<void>;
let tempDir: string;
let storage: LocalStorageProvider;
let paperService: PaperService;
let zipService: ZipStreamService;
let catalogService: CatalogService;

beforeEach(async () => {
  const created = await createInMemoryTestDb();
  db = created.db;
  closeDbFn = created.close;
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "papervault-zip-"));
  storage = new LocalStorageProvider(tempDir);
  await seedDatabase(db, storage);

  paperService = new PaperService(db, storage);
  zipService = new ZipStreamService(db, storage);
  catalogService = new CatalogService(db);
});

afterEach(async () => {
  await closeDbFn();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("Folder tree, streaming ZIP downloads & catalog services (Integration)", () => {
  it("builds Year -> Sem -> Branch -> ExamType folder tree and returns filter catalog", async () => {
    const filters = await paperService.getFilters();
    expect(filters.branches.length).toBeGreaterThanOrEqual(7);
    expect(filters.regulations.length).toBeGreaterThanOrEqual(3);

    const tree = await paperService.getFolderTree();
    expect(tree.length).toBe(4);
    const year2 = tree.find((y) => y.yearOfStudy === 2);
    const sem4 = year2?.semesters.find((s) => s.semester === 4);
    expect(sem4!.paperCount).toBeGreaterThanOrEqual(4);
  });

  it("streams a valid ZIP archive and enforces empty and 50-file limits", async () => {
    const [pending] = await db
      .select()
      .from(papers)
      .where(eq(papers.status, "PENDING"));
    const approvedRows = await db
      .select()
      .from(papers)
      .where(eq(papers.status, "APPROVED"));

    const result = await zipService.createZipArchiveStream({
      paperIds: [approvedRows[0].id, approvedRows[1].id, pending.id],
    });
    expect(result.includedCount).toBe(2);

    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const zipBuffer = Buffer.concat(chunks);
    expect(zipBuffer[0]).toBe(0x50);
    expect(zipBuffer[1]).toBe(0x4b);

    // Empty filter rejects cleanly with 404 ZipLimitError
    await expect(
      zipService.createZipArchiveStream({
        filter: { year: 4, sem: 8, branch: "CIVI", examType: "MID_2" },
      })
    ).rejects.toThrow(ZipLimitError);

    // >50 explicit IDs rejects cleanly
    const tooManyIds = Array.from({ length: 51 }, () => approvedRows[0].id);
    await expect(
      zipService.createZipArchiveStream({ paperIds: tooManyIds })
    ).rejects.toThrow(ZipLimitError);
  });

  it("streams ZIP from Year/Sem + Supply filter query", async () => {
    const result = await zipService.createZipArchiveStream({
      filter: { year: 2, sem: 4, examType: "SUPPLY" },
    });
    expect(result.includedCount).toBeGreaterThanOrEqual(2);
    expect(result.entries.every((e) => e.includes("/Supply/"))).toBe(true);
    result.stream.destroy();
  });

  it("creates branches, regulations, subjects, and imports CSV rows", async () => {
    const branch = await catalogService.createBranch("CSDS", "Data Science");
    const reg = await catalogService.createRegulation("R25", 2025);
    const subj = await catalogService.createSubject({
      code: "DS101",
      name: "Foundations of Data Science",
      branchId: branch.id,
      regulationId: reg.id,
      yearOfStudy: 1,
      semester: 1,
    });
    expect(subj.isCommonFirstYear).toBe(true);

    const fullCatalog = await catalogService.getCatalog();
    expect(fullCatalog.branches.some((b) => b.code === "CSDS")).toBe(true);

    const csv = [
      "code,name,branchCode,regulationCode,yearOfStudy,semester",
      "CS499,Cloud Native Engineering,CSE,R22,2,4",
      "CS999,Invalid Sem Mapping,CSE,R22,2,1",
      "BADLINE",
    ].join("\n");

    const summary = await catalogService.importSubjectsFromCsv(csv);
    expect(summary.inserted).toBe(1);
    expect(summary.skipped.length).toBe(2);

    // syncDefaultBranches idempotently upgrades legacy CIVIL / deactivates deprecated branches
    await db.insert(branches).values([
      { code: "IT", name: "Information Technology", isActive: true },
      { code: "AIML", name: "AI & ML", isActive: true },
    ]);
    await syncDefaultBranches(db);
    const syncedFilters = await paperService.getFilters();
    const activeCodes = syncedFilters.branches.map((b) => b.code);
    for (const code of ["CAI", "CSM", "CSD", "EEE", "ECE", "CIVI", "MECH", "CSE"]) {
      expect(activeCodes).toContain(code);
    }
    expect(activeCodes).not.toContain("IT");
    expect(activeCodes).not.toContain("AIML");
  });
});

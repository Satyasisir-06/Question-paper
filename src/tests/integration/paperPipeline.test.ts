import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createInMemoryTestDb, type AppDb } from "@/server/db/client";
import {
  seedDatabase,
  ensureAdminUser,
  generateSampleQuestionPaperPdf,
} from "@/server/db/seedData";
import { branches, papers, regulations, subjects, users } from "@/server/db/schema";
import { LocalStorageProvider } from "@/server/storage/localStorageProvider";
import { PaperService } from "@/server/services/paperService";
import { UploadService, UploadValidationError } from "@/server/services/uploadService";
import { ModerationService } from "@/server/services/moderationService";

let db: AppDb;
let closeDbFn: () => Promise<void>;
let tempDir: string;
let storage: LocalStorageProvider;
let paperService: PaperService;
let uploadService: UploadService;
let moderationService: ModerationService;

beforeEach(async () => {
  const created = await createInMemoryTestDb();
  db = created.db;
  closeDbFn = created.close;
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "papervault-int-"));
  storage = new LocalStorageProvider(tempDir);
  await seedDatabase(db, storage);

  paperService = new PaperService(db, storage);
  uploadService = new UploadService(db, storage);
  moderationService = new ModerationService(db, storage);
});

afterEach(async () => {
  await closeDbFn();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("Question paper moderation & filtering pipeline (Integration)", () => {
  it("filters approved papers by Year/Sem, branch, regulation, search & sort while hiding PENDING", async () => {
    const supply22 = await paperService.searchPublicPapers({
      year: 2,
      sem: 4,
      branch: "CSE",
      regulation: "R22",
      q: "CS401",
      examType: "SUPPLY",
      sort: "most_downloaded",
      page: 1,
      limit: 20,
    });

    expect(supply22.items.length).toBeGreaterThanOrEqual(1);
    expect(supply22.items[0].subjectCode).toBe("CS401");

    const bySubjectCode = await paperService.searchPublicPapers({
      sort: "subject_code",
      page: 1,
      limit: 10,
    });
    expect(bySubjectCode.meta.total).toBeGreaterThanOrEqual(10);

    const pendingRows = await db
      .select()
      .from(papers)
      .where(eq(papers.status, "PENDING"));
    expect(pendingRows.length).toBeGreaterThanOrEqual(1);
    expect(await paperService.getApprovedPaper(pendingRows[0].id)).toBeNull();
    expect(await paperService.openApprovedPdfStream(pendingRows[0].id, "view")).toBeNull();
  });

  it("streams approved PDF for view/download and increments counters", async () => {
    const [approved] = await db
      .select()
      .from(papers)
      .where(eq(papers.status, "APPROVED"));

    const viewRes = await paperService.openApprovedPdfStream(approved.id, "view");
    expect(viewRes?.filename).toContain(".pdf");
    viewRes?.stream.destroy();

    const dlRes = await paperService.openApprovedPdfStream(approved.id, "download");
    expect(dlRes?.sizeBytes).toBeGreaterThan(100);
    dlRes?.stream.destroy();

    const [updated] = await db.select().from(papers).where(eq(papers.id, approved.id));
    expect(updated.viewCount).toBe(approved.viewCount + 1);
    expect(updated.downloadCount).toBe(approved.downloadCount + 1);
  });

  it("quarantines student uploads, supports custom subjects & honeypot check, then approves and audits", async () => {
    const [cse] = await db.select().from(branches).where(eq(branches.code, "CSE"));
    const [r22] = await db.select().from(regulations).where(eq(regulations.code, "R22"));
    const [admin] = await db.select().from(users);

    const pdfBytes = await generateSampleQuestionPaperPdf({
      subjectCode: "CS490",
      subjectName: "Distributed Ledger Tech",
      branchCode: "CSE",
      regulationCode: "R22",
      yearOfStudy: 2,
      semester: 4,
      examType: "SUPPLY",
      examMonth: 12,
      examYear: 2025,
    });

    // Honeypot bot block
    await expect(
      uploadService.submitStudentPaper({
        fileBytes: pdfBytes,
        originalFilename: "bot.pdf",
        mimeType: "application/pdf",
        metadata: {
          branchId: cse.id,
          regulationId: r22.id,
          yearOfStudy: 2,
          semester: 4,
          customSubjectCode: "CS490",
          customSubjectName: "Distributed Ledger Tech",
          examType: "REGULAR",
          examMonth: 12,
          examYear: 2025,
          honeypot: "http://spam.example",
        },
      })
    ).rejects.toThrow(UploadValidationError);

    // Non-PDF file block
    await expect(
      uploadService.submitStudentPaper({
        fileBytes: new TextEncoder().encode("not a pdf"),
        originalFilename: "evil.pdf",
        mimeType: "application/pdf",
        metadata: {
          branchId: cse.id,
          regulationId: r22.id,
          yearOfStudy: 2,
          semester: 4,
          customSubjectCode: "CS490",
          customSubjectName: "Distributed Ledger Tech",
          examType: "REGULAR",
          examMonth: 12,
          examYear: 2025,
        },
      })
    ).rejects.toThrow(UploadValidationError);

    // Valid custom subject submission
    const uploadRes = await uploadService.submitStudentPaper({
      fileBytes: pdfBytes,
      originalFilename: "dlt_dec2025.pdf",
      mimeType: "application/pdf",
      metadata: {
        branchId: cse.id,
        regulationId: r22.id,
        yearOfStudy: 2,
        semester: 4,
        customSubjectCode: "CS490",
        customSubjectName: "Distributed Ledger Tech",
        examType: "REGULAR",
        examMonth: 12,
        examYear: 2025,
        setLabel: "Set B",
        uploaderName: "Rahul M",
        uploaderEmail: "rahul@college.edu",
      },
    });

    // Admin previews quarantined PDF
    const preview = await moderationService.openAdminPreviewStream(uploadRes.paperId);
    expect(preview).not.toBeNull();
    preview?.stream.destroy();

    const approved = await moderationService.approvePaper({
      paperId: uploadRes.paperId,
      adminUserId: admin.id,
      ipAddress: "127.0.0.1",
      updates: { examType: "SUPPLY" },
    });

    expect(approved.status).toBe("APPROVED");
    expect(approved.examType).toBe("SUPPLY");
    expect(approved.storageKey.startsWith("published/")).toBe(true);
  });

  it("supports admin direct publish, issue reporting, analytics, and idempotent admin ensure", async () => {
    await ensureAdminUser(db);
    const [cse] = await db.select().from(branches).where(eq(branches.code, "CSE"));
    const [r22] = await db.select().from(regulations).where(eq(regulations.code, "R22"));
    const [dbms] = await db.select().from(subjects).where(eq(subjects.code, "CS401"));
    const [admin] = await db.select().from(users);

    const pdfBytes = await generateSampleQuestionPaperPdf({
      subjectCode: "CS401",
      subjectName: "Database Management Systems",
      branchCode: "CSE",
      regulationCode: "R22",
      yearOfStudy: 2,
      semester: 4,
      examType: "REGULAR",
      examMonth: 5,
      examYear: 2025,
    });

    const published = await moderationService.directAdminPublish({
      adminUserId: admin.id,
      ipAddress: "127.0.0.1",
      fileBytes: pdfBytes,
      originalFilename: "official_dbms_2025.pdf",
      mimeType: "application/pdf",
      metadata: {
        branchId: cse.id,
        regulationId: r22.id,
        subjectId: dbms.id,
        yearOfStudy: 2,
        semester: 4,
        examType: "REGULAR",
        examMonth: 5,
        examYear: 2025,
      },
    });
    expect(published.status).toBe("APPROVED");

    const report = await paperService.reportPaper({
      paperId: published.id,
      reason: "Blurry or unreadable scan",
      details: "Page 2 rotated",
      ipAddress: "10.0.0.5",
    });
    expect(report?.status).toBe("OPEN");

    const analytics = await moderationService.getAnalytics();
    expect(analytics.kpis.approvedCount).toBeGreaterThanOrEqual(15);
    expect(analytics.kpis.openReportsCount).toBe(1);
    expect(analytics.semesterCoverage).toHaveLength(8);

    const resolved = await moderationService.resolveReport(
      report!.id,
      "RESOLVED",
      admin.id,
      "127.0.0.1"
    );
    expect(resolved?.status).toBe("RESOLVED");
  });

  it("rejects paper with reason and flags duplicate SHA-256 uploads", async () => {
    const [pending] = await db
      .select()
      .from(papers)
      .where(eq(papers.status, "PENDING"));
    const [admin] = await db.select().from(users);

    const rejected = await moderationService.rejectPaper({
      paperId: pending.id,
      adminUserId: admin.id,
      reason: "Pages 2 and 3 are blurry and unreadable.",
      ipAddress: "127.0.0.1",
    });
    expect(rejected.status).toBe("REJECTED");

    const [cse] = await db.select().from(branches).where(eq(branches.code, "CSE"));
    const [r22] = await db.select().from(regulations).where(eq(regulations.code, "R22"));
    const [dbms] = await db.select().from(subjects).where(eq(subjects.code, "CS401"));
    const [existing] = await db
      .select()
      .from(papers)
      .where(eq(papers.trackingCode, "PV-2201F6"));
    const existingBytes = await storage.getObjectBuffer(existing.storageKey);

    const dupUpload = await uploadService.submitStudentPaper({
      fileBytes: existingBytes,
      originalFilename: "dup_dbms.pdf",
      mimeType: "application/pdf",
      metadata: {
        branchId: cse.id,
        regulationId: r22.id,
        yearOfStudy: 2,
        semester: 4,
        subjectId: dbms.id,
        examType: "REGULAR",
        examMonth: 5,
        examYear: 2024,
      },
    });

    const queue = await moderationService.listAdminPapers("PENDING");
    const flagged = queue.find((item) => item.id === dupUpload.paperId);
    expect(flagged?.duplicateMatches[0]?.id).toBe(existing.id);
  });
});

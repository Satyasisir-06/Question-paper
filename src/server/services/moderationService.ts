import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import type { AppDb } from "@/server/db/client";
import { auditLogs, branches, papers, subjects } from "@/server/db/schema";
import type { StorageProvider } from "@/server/storage";
import {
  PaperRepository,
  type PaperStorageRecord,
} from "@/server/repositories/paperRepo";
import { validatePdfBuffer } from "@/server/validators/pdfValidator";
import { generateTrackingCode } from "@/lib/apiResponse";
import { sanitizePathSegment, type ExamTypeValue, type PaperStatusValue } from "@/lib/btech";
import { UploadValidationError } from "./uploadService";

export interface AdminPaperQueueItem extends PaperStorageRecord {
  duplicateMatches: Array<{ id: string; trackingCode: string; status: PaperStatusValue }>;
}

export class ModerationService {
  private readonly paperRepo: PaperRepository;

  constructor(
    private readonly db: AppDb,
    private readonly storage: StorageProvider
  ) {
    this.paperRepo = new PaperRepository(db);
  }

  async listAdminPapers(status: PaperStatusValue): Promise<AdminPaperQueueItem[]> {
    const list = await this.paperRepo.listByStatus(status);
    const enriched = await Promise.all(
      list.map(async (item) => {
        const duplicateMatches = await this.paperRepo.findDuplicatesBySha256(
          item.sha256Hash,
          item.id
        );
        return { ...item, duplicateMatches };
      })
    );
    return enriched;
  }

  async openAdminPreviewStream(paperId: string): Promise<{
    stream: Readable;
    filename: string;
    sizeBytes: number;
  } | null> {
    const record = await this.paperRepo.findAnyById(paperId);
    if (!record) return null;
    const stream = await this.storage.getObjectStream(record.storageKey);
    return {
      stream,
      filename: record.originalFilename,
      sizeBytes: record.fileSizeBytes,
    };
  }

  async approvePaper(input: {
    paperId: string;
    adminUserId: string;
    ipAddress: string;
    updates?: {
      branchId?: string;
      regulationId?: string;
      subjectId?: string;
      yearOfStudy?: number;
      semester?: number;
      examType?: ExamTypeValue;
      examMonth?: number;
      examYear?: number;
      setLabel?: string | null;
    };
  }) {
    const existing = await this.paperRepo.findAnyById(input.paperId);
    if (!existing) {
      throw new UploadValidationError("NOT_FOUND", "Submission not found.", 404);
    }

    const nextBranchId = input.updates?.branchId ?? existing.branchId;
    const nextRegId = input.updates?.regulationId ?? existing.regulationId;
    const nextSubjectId = input.updates?.subjectId ?? existing.subjectId;
    const nextYear = input.updates?.yearOfStudy ?? existing.yearOfStudy;
    const nextSem = input.updates?.semester ?? existing.semester;
    const nextExamType = input.updates?.examType ?? existing.examType;
    const nextExamMonth = input.updates?.examMonth ?? existing.examMonth;
    const nextExamYear = input.updates?.examYear ?? existing.examYear;
    const nextSetLabel =
      input.updates?.setLabel !== undefined ? input.updates.setLabel : existing.setLabel;

    const [branchRow] = await this.db
      .select()
      .from(branches)
      .where(eq(branches.id, nextBranchId));
    const [subjectRow] = await this.db
      .select()
      .from(subjects)
      .where(eq(subjects.id, nextSubjectId));

    const branchCode = sanitizePathSegment(branchRow?.code ?? existing.branchCode);
    const subjectCode = sanitizePathSegment(subjectRow?.code ?? existing.subjectCode);
    const publishedKey = `published/${branchCode}/${nextYear}-${nextSem}/${nextExamType}/${subjectCode}_${nextExamYear}_${existing.trackingCode}.pdf`;

    if (existing.storageKey !== publishedKey && (await this.storage.exists(existing.storageKey))) {
      await this.storage.moveObject(existing.storageKey, publishedKey);
    }

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(papers)
        .set({
          branchId: nextBranchId,
          regulationId: nextRegId,
          subjectId: nextSubjectId,
          yearOfStudy: nextYear,
          semester: nextSem,
          examType: nextExamType,
          examMonth: nextExamMonth,
          examYear: nextExamYear,
          setLabel: nextSetLabel,
          storageKey: publishedKey,
          status: "APPROVED",
          reviewedBy: input.adminUserId,
          reviewedAt: new Date(),
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(papers.id, input.paperId))
        .returning();

      await tx.insert(auditLogs).values({
        actorId: input.adminUserId,
        action: "APPROVE",
        entityType: "paper",
        entityId: input.paperId,
        metadataJson: {
          trackingCode: existing.trackingCode,
          previousStatus: existing.status,
          examType: nextExamType,
          yearOfStudy: nextYear,
          semester: nextSem,
        },
        ipAddress: input.ipAddress,
      });

      return row;
    });

    return updated;
  }

  async rejectPaper(input: {
    paperId: string;
    adminUserId: string;
    reason: string;
    ipAddress: string;
  }) {
    const existing = await this.paperRepo.findAnyById(input.paperId);
    if (!existing) {
      throw new UploadValidationError("NOT_FOUND", "Submission not found.", 404);
    }

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(papers)
        .set({
          status: "REJECTED",
          rejectionReason: input.reason.trim(),
          reviewedBy: input.adminUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(papers.id, input.paperId))
        .returning();

      await tx.insert(auditLogs).values({
        actorId: input.adminUserId,
        action: "REJECT",
        entityType: "paper",
        entityId: input.paperId,
        metadataJson: {
          trackingCode: existing.trackingCode,
          reason: input.reason.trim(),
        },
        ipAddress: input.ipAddress,
      });

      return row;
    });

    return updated;
  }

  async directAdminPublish(input: {
    adminUserId: string;
    ipAddress: string;
    fileBytes: Uint8Array;
    originalFilename: string;
    mimeType?: string;
    metadata: {
      branchId: string;
      regulationId: string;
      subjectId: string;
      yearOfStudy: number;
      semester: number;
      examType: ExamTypeValue;
      examMonth: number;
      examYear: number;
      setLabel?: string;
    };
  }) {
    const pdfCheck = await validatePdfBuffer(input.fileBytes, input.mimeType);
    if (!pdfCheck.valid) {
      throw new UploadValidationError(pdfCheck.code, pdfCheck.message, 400);
    }

    const [branchRow] = await this.db
      .select()
      .from(branches)
      .where(eq(branches.id, input.metadata.branchId));
    const [subjectRow] = await this.db
      .select()
      .from(subjects)
      .where(eq(subjects.id, input.metadata.subjectId));

    if (!branchRow || !subjectRow) {
      throw new UploadValidationError(
        "INVALID_CATALOG_REF",
        "Branch or subject does not exist.",
        400
      );
    }

    const trackingCode = generateTrackingCode();
    const publishedKey = `published/${sanitizePathSegment(branchRow.code)}/${input.metadata.yearOfStudy}-${input.metadata.semester}/${input.metadata.examType}/${sanitizePathSegment(subjectRow.code)}_${input.metadata.examYear}_${randomUUID().slice(0, 8)}.pdf`;

    await this.storage.putObject(publishedKey, input.fileBytes, "application/pdf");

    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(papers)
        .values({
          trackingCode,
          subjectId: input.metadata.subjectId,
          branchId: input.metadata.branchId,
          regulationId: input.metadata.regulationId,
          yearOfStudy: input.metadata.yearOfStudy,
          semester: input.metadata.semester,
          examType: input.metadata.examType,
          examMonth: input.metadata.examMonth,
          examYear: input.metadata.examYear,
          setLabel: input.metadata.setLabel?.trim() || null,
          storageKey: publishedKey,
          originalFilename: input.originalFilename.slice(0, 250) || "paper.pdf",
          fileSizeBytes: pdfCheck.sizeBytes,
          pageCount: pdfCheck.pageCount,
          sha256Hash: pdfCheck.sha256Hash,
          status: "APPROVED",
          uploaderName: "Exam Cell Admin",
          reviewedBy: input.adminUserId,
          reviewedAt: new Date(),
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorId: input.adminUserId,
        action: "ADMIN_DIRECT_PUBLISH",
        entityType: "paper",
        entityId: inserted.id,
        metadataJson: {
          trackingCode,
          subjectCode: subjectRow.code,
          examType: input.metadata.examType,
        },
        ipAddress: input.ipAddress,
      });

      return inserted;
    });
  }

  async getAnalytics() {
    const [allPapers, allSubjects, reports] = await Promise.all([
      this.db
        .select({
          status: papers.status,
          examType: papers.examType,
          yearOfStudy: papers.yearOfStudy,
          semester: papers.semester,
          downloadCount: papers.downloadCount,
          subjectId: papers.subjectId,
        })
        .from(papers),
      this.db
        .select({
          id: subjects.id,
          code: subjects.code,
          name: subjects.name,
          yearOfStudy: subjects.yearOfStudy,
          semester: subjects.semester,
          branchCode: branches.code,
        })
        .from(subjects)
        .innerJoin(branches, eq(subjects.branchId, branches.id)),
      this.paperRepo.listReports(),
    ]);

    const approved = allPapers.filter((p) => p.status === "APPROVED");
    const pendingCount = allPapers.filter((p) => p.status === "PENDING").length;
    const totalDownloads = approved.reduce((sum, p) => sum + p.downloadCount, 0);
    const openReportsCount = reports.filter((r) => r.status === "OPEN").length;

    const semesterCoverage = Array.from({ length: 8 }, (_, idx) => {
      const sem = idx + 1;
      const year = Math.ceil(sem / 2);
      const semPapers = approved.filter((p) => p.semester === sem);
      return {
        code: `${year}-${sem % 2 === 1 ? 1 : 2}`,
        yearOfStudy: year,
        semester: sem,
        regularCount: semPapers.filter((p) => p.examType === "REGULAR").length,
        supplyCount: semPapers.filter((p) => p.examType === "SUPPLY").length,
      };
    });

    const subjectSupplyCounts = new Map<string, { regular: number; supply: number }>();
    for (const p of approved) {
      const prev = subjectSupplyCounts.get(p.subjectId) ?? { regular: 0, supply: 0 };
      if (p.examType === "REGULAR") prev.regular += 1;
      if (p.examType === "SUPPLY") prev.supply += 1;
      subjectSupplyCounts.set(p.subjectId, prev);
    }

    const coverageGaps = allSubjects
      .map((s) => {
        const counts = subjectSupplyCounts.get(s.id) ?? { regular: 0, supply: 0 };
        return {
          subjectId: s.id,
          code: s.code,
          name: s.name,
          branchCode: s.branchCode,
          yearSem: `${s.yearOfStudy}-${s.semester % 2 === 1 ? 1 : 2}`,
          missingRegular: counts.regular === 0,
          missingSupply: counts.supply === 0,
        };
      })
      .filter((g) => g.missingRegular || g.missingSupply)
      .slice(0, 10);

    return {
      kpis: {
        pendingCount,
        approvedCount: approved.length,
        totalDownloads,
        openReportsCount,
      },
      semesterCoverage,
      coverageGaps,
      reports,
    };
  }

  async resolveReport(
    reportId: string,
    status: "RESOLVED" | "DISMISSED",
    adminUserId: string,
    ipAddress: string
  ) {
    const updated = await this.paperRepo.updateReportStatus(reportId, status);
    if (updated) {
      await this.db.insert(auditLogs).values({
        actorId: adminUserId,
        action: `REPORT_${status}`,
        entityType: "paper_report",
        entityId: reportId,
        metadataJson: { paperId: updated.paperId },
        ipAddress,
      });
    }
    return updated;
  }

  async listAuditLogs(limit = 50) {
    return this.paperRepo.listAuditLogs(limit);
  }
}

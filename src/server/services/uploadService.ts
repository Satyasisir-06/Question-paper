import { randomUUID } from "node:crypto";
import type { AppDb } from "@/server/db/client";
import { getStorageProvider, type StorageProvider } from "@/server/storage";
import { PaperRepository } from "@/server/repositories/paperRepo";
import { CatalogRepository } from "@/server/repositories/catalogRepo";
import { validatePdfBuffer } from "@/server/validators/pdfValidator";
import { generateTrackingCode } from "@/lib/apiResponse";
import type { ExamTypeValue } from "@/lib/btech";

export class UploadValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export interface StudentUploadInput {
  fileBytes: Uint8Array;
  originalFilename: string;
  mimeType?: string;
  metadata: {
    branchId: string;
    regulationId: string;
    yearOfStudy: number;
    semester: number;
    subjectId?: string;
    customSubjectCode?: string;
    customSubjectName?: string;
    examType: ExamTypeValue;
    examMonth: number;
    examYear: number;
    setLabel?: string;
    uploaderName?: string;
    uploaderEmail?: string;
    honeypot?: string;
  };
}

export class UploadService {
  private readonly paperRepo: PaperRepository;
  private readonly catalogRepo: CatalogRepository;

  constructor(
    db: AppDb,
    private readonly storage?: StorageProvider
  ) {
    this.paperRepo = new PaperRepository(db);
    this.catalogRepo = new CatalogRepository(db);
  }

  async submitStudentPaper(input: StudentUploadInput): Promise<{
    paperId: string;
    trackingCode: string;
    status: "PENDING";
    pageCount: number;
  }> {
    if (input.metadata.honeypot && input.metadata.honeypot.length > 0) {
      throw new UploadValidationError(
        "BOT_DETECTED",
        "Upload rejected by automated spam check.",
        400
      );
    }

    const pdfCheck = await validatePdfBuffer(input.fileBytes, input.mimeType);
    if (!pdfCheck.valid) {
      throw new UploadValidationError(pdfCheck.code, pdfCheck.message, 400);
    }

    let resolvedSubjectId = input.metadata.subjectId?.trim() || "";
    if (!resolvedSubjectId) {
      const code = input.metadata.customSubjectCode?.trim();
      const name = input.metadata.customSubjectName?.trim();
      if (!code || !name) {
        throw new UploadValidationError(
          "SUBJECT_REQUIRED",
          "Select an existing subject or provide a subject code and name.",
          400
        );
      }
      const createdSubject = await this.catalogRepo.findOrCreateSubject({
        code,
        name,
        branchId: input.metadata.branchId,
        regulationId: input.metadata.regulationId,
        yearOfStudy: input.metadata.yearOfStudy,
        semester: input.metadata.semester,
      });
      resolvedSubjectId = createdSubject.id;
    }

    const objectId = randomUUID();
    const storageKey = `quarantine/${objectId}.pdf`;
    const trackingCode = generateTrackingCode();

    const storage = this.storage ?? getStorageProvider();
    await storage.putObject(storageKey, input.fileBytes, "application/pdf");

    const inserted = await this.paperRepo.insertPaper({
      trackingCode,
      subjectId: resolvedSubjectId,
      branchId: input.metadata.branchId,
      regulationId: input.metadata.regulationId,
      yearOfStudy: input.metadata.yearOfStudy,
      semester: input.metadata.semester,
      examType: input.metadata.examType,
      examMonth: input.metadata.examMonth,
      examYear: input.metadata.examYear,
      setLabel: input.metadata.setLabel?.trim() || null,
      storageKey,
      originalFilename: input.originalFilename.slice(0, 250) || "paper.pdf",
      fileSizeBytes: pdfCheck.sizeBytes,
      pageCount: pdfCheck.pageCount,
      sha256Hash: pdfCheck.sha256Hash,
      status: "PENDING", // Always strictly quarantined regardless of client payload
      uploaderName: input.metadata.uploaderName?.trim() || null,
      uploaderEmail: input.metadata.uploaderEmail?.trim() || null,
    });

    return {
      paperId: inserted.id,
      trackingCode: inserted.trackingCode,
      status: "PENDING",
      pageCount: pdfCheck.pageCount,
    };
  }

  async trackByCode(trackingCode: string) {
    const row = await this.paperRepo.findByTrackingCode(trackingCode);
    if (!row) return null;
    return {
      paperId: row.status === "APPROVED" ? row.id : null,
      trackingCode: row.trackingCode,
      status: row.status,
      subjectCode: row.subjectCode,
      subjectName: row.subjectName,
      branchCode: row.branchCode,
      regulationCode: row.regulationCode,
      yearOfStudy: row.yearOfStudy,
      semester: row.semester,
      examType: row.examType,
      examMonth: row.examMonth,
      examYear: row.examYear,
      rejectionReason: row.status === "REJECTED" ? row.rejectionReason : null,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
    };
  }
}

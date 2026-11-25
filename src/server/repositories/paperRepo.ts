import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "@/server/db/client";
import {
  auditLogs,
  branches,
  paperReports,
  papers,
  regulations,
  subjects,
} from "@/server/db/schema";
import type { ExamTypeValue, PaperStatusValue } from "@/lib/btech";

export interface PublicPaperItem {
  id: string;
  trackingCode: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  regulationId: string;
  regulationCode: string;
  yearOfStudy: number;
  semester: number;
  examType: ExamTypeValue;
  examMonth: number;
  examYear: number;
  setLabel: string | null;
  fileSizeBytes: number;
  pageCount: number;
  status: PaperStatusValue;
  uploaderName: string | null;
  downloadCount: number;
  viewCount: number;
  createdAt: Date;
}

export interface PaperStorageRecord extends PublicPaperItem {
  storageKey: string;
  originalFilename: string;
  sha256Hash: string;
  uploaderEmail: string | null;
  rejectionReason: string | null;
  reviewedAt: Date | null;
}

export interface PaperFilterParams {
  q?: string;
  year?: number;
  sem?: number;
  branch?: string;
  regulation?: string;
  examType?: ExamTypeValue;
  examYear?: number;
  subjectId?: string;
}

const PAPER_SELECT_FIELDS = {
  id: papers.id,
  trackingCode: papers.trackingCode,
  subjectId: papers.subjectId,
  subjectCode: subjects.code,
  subjectName: subjects.name,
  branchId: papers.branchId,
  branchCode: branches.code,
  branchName: branches.name,
  regulationId: papers.regulationId,
  regulationCode: regulations.code,
  yearOfStudy: papers.yearOfStudy,
  semester: papers.semester,
  examType: papers.examType,
  examMonth: papers.examMonth,
  examYear: papers.examYear,
  setLabel: papers.setLabel,
  storageKey: papers.storageKey,
  originalFilename: papers.originalFilename,
  fileSizeBytes: papers.fileSizeBytes,
  pageCount: papers.pageCount,
  sha256Hash: papers.sha256Hash,
  status: papers.status,
  uploaderName: papers.uploaderName,
  uploaderEmail: papers.uploaderEmail,
  rejectionReason: papers.rejectionReason,
  reviewedAt: papers.reviewedAt,
  downloadCount: papers.downloadCount,
  viewCount: papers.viewCount,
  createdAt: papers.createdAt,
};

function toPublicItem(row: PaperStorageRecord): PublicPaperItem {
  return {
    id: row.id,
    trackingCode: row.trackingCode,
    subjectId: row.subjectId,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    branchId: row.branchId,
    branchCode: row.branchCode,
    branchName: row.branchName,
    regulationId: row.regulationId,
    regulationCode: row.regulationCode,
    yearOfStudy: row.yearOfStudy,
    semester: row.semester,
    examType: row.examType,
    examMonth: row.examMonth,
    examYear: row.examYear,
    setLabel: row.setLabel,
    fileSizeBytes: row.fileSizeBytes,
    pageCount: row.pageCount,
    status: row.status,
    uploaderName: row.uploaderName,
    downloadCount: row.downloadCount,
    viewCount: row.viewCount,
    createdAt: row.createdAt,
  };
}

export class PaperRepository {
  constructor(private readonly db: AppDb) {}

  private buildApprovedConditions(filters: PaperFilterParams): SQL[] {
    const conds: SQL[] = [eq(papers.status, "APPROVED")];
    if (filters.year !== undefined) conds.push(eq(papers.yearOfStudy, filters.year));
    if (filters.sem !== undefined) conds.push(eq(papers.semester, filters.sem));
    if (filters.examType !== undefined) conds.push(eq(papers.examType, filters.examType));
    if (filters.examYear !== undefined) conds.push(eq(papers.examYear, filters.examYear));
    if (filters.subjectId !== undefined) conds.push(eq(papers.subjectId, filters.subjectId));
    if (filters.branch) {
      conds.push(eq(branches.code, filters.branch.toUpperCase()));
    }
    if (filters.regulation) {
      conds.push(eq(regulations.code, filters.regulation.toUpperCase()));
    }
    if (filters.q) {
      const pattern = `%${filters.q}%`;
      conds.push(
        or(
          ilike(subjects.code, pattern),
          ilike(subjects.name, pattern),
          ilike(papers.setLabel, pattern)
        )!
      );
    }
    return conds;
  }

  async searchApproved(
    filters: PaperFilterParams & {
      sort: "newest" | "most_downloaded" | "subject_code";
      page: number;
      limit: number;
    }
  ): Promise<{ items: PublicPaperItem[]; total: number }> {
    const whereClause = and(...this.buildApprovedConditions(filters));

    const orderByClauses =
      filters.sort === "most_downloaded"
        ? [desc(papers.downloadCount), desc(papers.examYear), desc(papers.examMonth)]
        : filters.sort === "subject_code"
          ? [asc(subjects.code), desc(papers.examYear)]
          : [desc(papers.examYear), desc(papers.examMonth), desc(papers.createdAt)];

    const offset = (filters.page - 1) * filters.limit;

    const [rows, countResult] = await Promise.all([
      this.db
        .select(PAPER_SELECT_FIELDS)
        .from(papers)
        .innerJoin(subjects, eq(papers.subjectId, subjects.id))
        .innerJoin(branches, eq(papers.branchId, branches.id))
        .innerJoin(regulations, eq(papers.regulationId, regulations.id))
        .where(whereClause)
        .orderBy(...orderByClauses)
        .limit(filters.limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(papers)
        .innerJoin(subjects, eq(papers.subjectId, subjects.id))
        .innerJoin(branches, eq(papers.branchId, branches.id))
        .innerJoin(regulations, eq(papers.regulationId, regulations.id))
        .where(whereClause),
    ]);

    return {
      items: rows.map(toPublicItem),
      total: Number(countResult[0]?.value ?? 0),
    };
  }

  async findApprovedById(id: string): Promise<PaperStorageRecord | null> {
    const rows = await this.db
      .select(PAPER_SELECT_FIELDS)
      .from(papers)
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .innerJoin(branches, eq(papers.branchId, branches.id))
      .innerJoin(regulations, eq(papers.regulationId, regulations.id))
      .where(and(eq(papers.id, id), eq(papers.status, "APPROVED")));

    return rows[0] ?? null;
  }

  async findAnyById(id: string): Promise<PaperStorageRecord | null> {
    const rows = await this.db
      .select(PAPER_SELECT_FIELDS)
      .from(papers)
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .innerJoin(branches, eq(papers.branchId, branches.id))
      .innerJoin(regulations, eq(papers.regulationId, regulations.id))
      .where(eq(papers.id, id));

    return rows[0] ?? null;
  }

  async findApprovedByIds(ids: string[]): Promise<PaperStorageRecord[]> {
    if (ids.length === 0) return [];
    return this.db
      .select(PAPER_SELECT_FIELDS)
      .from(papers)
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .innerJoin(branches, eq(papers.branchId, branches.id))
      .innerJoin(regulations, eq(papers.regulationId, regulations.id))
      .where(and(eq(papers.status, "APPROVED"), inArray(papers.id, ids)))
      .orderBy(asc(papers.yearOfStudy), asc(papers.semester), asc(subjects.code));
  }

  async findApprovedByFilterForZip(
    filters: PaperFilterParams,
    maxLimit: number
  ): Promise<PaperStorageRecord[]> {
    return this.db
      .select(PAPER_SELECT_FIELDS)
      .from(papers)
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .innerJoin(branches, eq(papers.branchId, branches.id))
      .innerJoin(regulations, eq(papers.regulationId, regulations.id))
      .where(and(...this.buildApprovedConditions(filters)))
      .orderBy(asc(papers.yearOfStudy), asc(papers.semester), asc(subjects.code))
      .limit(maxLimit);
  }

  async listAllApprovedForTree(): Promise<PublicPaperItem[]> {
    const rows = await this.db
      .select(PAPER_SELECT_FIELDS)
      .from(papers)
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .innerJoin(branches, eq(papers.branchId, branches.id))
      .innerJoin(regulations, eq(papers.regulationId, regulations.id))
      .where(eq(papers.status, "APPROVED"))
      .orderBy(
        asc(papers.yearOfStudy),
        asc(papers.semester),
        asc(branches.code),
        asc(papers.examType),
        asc(subjects.code),
        desc(papers.examYear)
      );
    return rows.map(toPublicItem);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.db
      .update(papers)
      .set({ viewCount: sql`${papers.viewCount} + 1` })
      .where(eq(papers.id, id));
  }

  async incrementDownloadCount(id: string): Promise<void> {
    await this.db
      .update(papers)
      .set({ downloadCount: sql`${papers.downloadCount} + 1` })
      .where(eq(papers.id, id));
  }

  async findByTrackingCode(code: string): Promise<PaperStorageRecord | null> {
    const rows = await this.db
      .select(PAPER_SELECT_FIELDS)
      .from(papers)
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .innerJoin(branches, eq(papers.branchId, branches.id))
      .innerJoin(regulations, eq(papers.regulationId, regulations.id))
      .where(eq(papers.trackingCode, code.trim().toUpperCase()));
    return rows[0] ?? null;
  }

  async findDuplicatesBySha256(
    sha256Hash: string,
    excludeId?: string
  ): Promise<Array<{ id: string; trackingCode: string; status: PaperStatusValue }>> {
    const rows = await this.db
      .select({
        id: papers.id,
        trackingCode: papers.trackingCode,
        status: papers.status,
      })
      .from(papers)
      .where(eq(papers.sha256Hash, sha256Hash));

    return excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
  }

  async insertPaper(input: typeof papers.$inferInsert) {
    const [row] = await this.db.insert(papers).values(input).returning();
    return row;
  }

  async listByStatus(status: PaperStatusValue): Promise<PaperStorageRecord[]> {
    return this.db
      .select(PAPER_SELECT_FIELDS)
      .from(papers)
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .innerJoin(branches, eq(papers.branchId, branches.id))
      .innerJoin(regulations, eq(papers.regulationId, regulations.id))
      .where(eq(papers.status, status))
      .orderBy(desc(papers.createdAt));
  }

  async createReport(input: {
    paperId: string;
    reason: string;
    details?: string;
    reporterIpHash: string;
  }) {
    const [row] = await this.db.insert(paperReports).values(input).returning();
    return row;
  }

  async listReports() {
    return this.db
      .select({
        id: paperReports.id,
        paperId: paperReports.paperId,
        reason: paperReports.reason,
        details: paperReports.details,
        status: paperReports.status,
        createdAt: paperReports.createdAt,
        trackingCode: papers.trackingCode,
        subjectCode: subjects.code,
        subjectName: subjects.name,
      })
      .from(paperReports)
      .innerJoin(papers, eq(paperReports.paperId, papers.id))
      .innerJoin(subjects, eq(papers.subjectId, subjects.id))
      .orderBy(desc(paperReports.createdAt));
  }

  async updateReportStatus(
    id: string,
    status: "OPEN" | "RESOLVED" | "DISMISSED"
  ) {
    const [row] = await this.db
      .update(paperReports)
      .set({ status })
      .where(eq(paperReports.id, id))
      .returning();
    return row ?? null;
  }

  async listAuditLogs(limit = 50) {
    return this.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

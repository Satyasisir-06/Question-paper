import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import type { AppDb } from "@/server/db/client";
import type { StorageProvider } from "@/server/storage";
import {
  PaperRepository,
  type PaperFilterParams,
  type PublicPaperItem,
} from "@/server/repositories/paperRepo";
import { CatalogRepository } from "@/server/repositories/catalogRepo";
import { formatPaperFilename, YEAR_SEM_OPTIONS, type ExamTypeValue } from "@/lib/btech";
import type { PaginationMeta } from "@/lib/apiResponse";

export interface FolderTreeSemesterNode {
  yearOfStudy: number;
  semester: number;
  code: string;
  label: string;
  paperCount: number;
  branches: Array<{
    branchCode: string;
    branchName: string;
    paperCount: number;
    regularCount: number;
    supplyCount: number;
    papers: PublicPaperItem[];
  }>;
}

export interface FolderTreeYearNode {
  yearOfStudy: number;
  label: string;
  paperCount: number;
  semesters: FolderTreeSemesterNode[];
}

export class PaperService {
  private readonly paperRepo: PaperRepository;
  private readonly catalogRepo: CatalogRepository;

  constructor(
    db: AppDb,
    private readonly storage: StorageProvider
  ) {
    this.paperRepo = new PaperRepository(db);
    this.catalogRepo = new CatalogRepository(db);
  }

  async getFilters() {
    return this.catalogRepo.getPublicFilterCatalog();
  }

  async searchPublicPapers(
    params: PaperFilterParams & {
      sort: "newest" | "most_downloaded" | "subject_code";
      page: number;
      limit: number;
    }
  ): Promise<{ items: PublicPaperItem[]; meta: PaginationMeta }> {
    const { items, total } = await this.paperRepo.searchApproved(params);
    const totalPages = Math.max(1, Math.ceil(total / params.limit));
    return {
      items,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
      },
    };
  }

  async getApprovedPaper(id: string): Promise<PublicPaperItem | null> {
    const record = await this.paperRepo.findApprovedById(id);
    if (!record) return null;
    const {
      storageKey: _sk,
      originalFilename: _of,
      sha256Hash: _sh,
      uploaderEmail: _ue,
      rejectionReason: _rr,
      reviewedAt: _ra,
      ...publicItem
    } = record;
    void _sk;
    void _of;
    void _sh;
    void _ue;
    void _rr;
    void _ra;
    return publicItem;
  }

  async openApprovedPdfStream(
    id: string,
    mode: "view" | "download"
  ): Promise<{ stream: Readable; filename: string; sizeBytes: number } | null> {
    const record = await this.paperRepo.findApprovedById(id);
    if (!record) return null;

    const stream = await this.storage.getObjectStream(record.storageKey);
    if (mode === "view") {
      await this.paperRepo.incrementViewCount(id);
    } else {
      await this.paperRepo.incrementDownloadCount(id);
    }

    const filename = formatPaperFilename({
      branchCode: record.branchCode,
      yearOfStudy: record.yearOfStudy,
      semester: record.semester,
      subjectCode: record.subjectCode,
      subjectName: record.subjectName,
      examType: record.examType as ExamTypeValue,
      examMonth: record.examMonth,
      examYear: record.examYear,
      setLabel: record.setLabel,
    });

    return {
      stream,
      filename,
      sizeBytes: record.fileSizeBytes,
    };
  }

  async getFolderTree(): Promise<FolderTreeYearNode[]> {
    const allApproved = await this.paperRepo.listAllApprovedForTree();

    const yearMap = new Map<number, FolderTreeYearNode>();
    for (let y = 1; y <= 4; y++) {
      yearMap.set(y, {
        yearOfStudy: y,
        label: `Year ${y}`,
        paperCount: 0,
        semesters: YEAR_SEM_OPTIONS.filter((opt) => opt.year === y).map((opt) => ({
          yearOfStudy: y,
          semester: opt.sem,
          code: opt.code,
          label: opt.label,
          paperCount: 0,
          branches: [],
        })),
      });
    }

    for (const paper of allApproved) {
      const yearNode = yearMap.get(paper.yearOfStudy);
      if (!yearNode) continue;
      yearNode.paperCount += 1;

      const semNode = yearNode.semesters.find(
        (s) => s.semester === paper.semester
      );
      if (!semNode) continue;
      semNode.paperCount += 1;

      let branchNode = semNode.branches.find(
        (b) => b.branchCode === paper.branchCode
      );
      if (!branchNode) {
        branchNode = {
          branchCode: paper.branchCode,
          branchName: paper.branchName,
          paperCount: 0,
          regularCount: 0,
          supplyCount: 0,
          papers: [],
        };
        semNode.branches.push(branchNode);
      }

      branchNode.paperCount += 1;
      if (paper.examType === "SUPPLY") {
        branchNode.supplyCount += 1;
      } else if (paper.examType === "REGULAR") {
        branchNode.regularCount += 1;
      }
      branchNode.papers.push(paper);
    }

    return Array.from(yearMap.values());
  }

  async reportPaper(input: {
    paperId: string;
    reason: string;
    details?: string;
    ipAddress: string;
  }) {
    const existing = await this.paperRepo.findApprovedById(input.paperId);
    if (!existing) {
      return null;
    }
    const reporterIpHash = createHash("sha256")
      .update(input.ipAddress)
      .digest("hex");
    return this.paperRepo.createReport({
      paperId: input.paperId,
      reason: input.reason,
      details: input.details,
      reporterIpHash,
    });
  }
}

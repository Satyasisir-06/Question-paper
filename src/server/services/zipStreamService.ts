import { ZipArchive } from "archiver";
import { PassThrough, type Readable } from "node:stream";
import type { AppDb } from "@/server/db/client";
import type { StorageProvider } from "@/server/storage";
import {
  PaperRepository,
  type PaperFilterParams,
  type PaperStorageRecord,
} from "@/server/repositories/paperRepo";
import { formatZipEntryPath, type ExamTypeValue } from "@/lib/btech";

export const MAX_ZIP_FILES = 50;
export const MAX_ZIP_TOTAL_BYTES = 150 * 1024 * 1024; // 150 MB

export class ZipLimitError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export class ZipStreamService {
  private readonly paperRepo: PaperRepository;

  constructor(
    db: AppDb,
    private readonly storage: StorageProvider
  ) {
    this.paperRepo = new PaperRepository(db);
  }

  async createZipArchiveStream(
    input: { paperIds: string[] } | { filter: PaperFilterParams }
  ): Promise<{
    stream: Readable;
    filename: string;
    includedCount: number;
    entries: string[];
  }> {
    let records: PaperStorageRecord[];
    if ("paperIds" in input) {
      if (input.paperIds.length > MAX_ZIP_FILES) {
        throw new ZipLimitError(
          "ZIP_TOO_MANY_FILES",
          `Folder download is limited to ${MAX_ZIP_FILES} papers at once.`
        );
      }
      records = await this.paperRepo.findApprovedByIds(input.paperIds);
    } else {
      records = await this.paperRepo.findApprovedByFilterForZip(
        input.filter,
        MAX_ZIP_FILES + 1
      );
      if (records.length > MAX_ZIP_FILES) {
        throw new ZipLimitError(
          "ZIP_TOO_MANY_FILES",
          `Filtered folder contains more than ${MAX_ZIP_FILES} papers. Narrow your Year/Sem or Branch filter before downloading.`
        );
      }
    }

    if (records.length === 0) {
      throw new ZipLimitError(
        "ZIP_EMPTY",
        "No approved question papers match your folder selection.",
        404
      );
    }

    const totalBytes = records.reduce((sum, r) => sum + r.fileSizeBytes, 0);
    if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
      throw new ZipLimitError(
        "ZIP_TOO_LARGE",
        "Selected folder exceeds the 150 MB archive download limit."
      );
    }

    const archive = new ZipArchive({ zlib: { level: 5 } });
    const passThrough = new PassThrough();

    archive.on("error", (err) => {
      passThrough.destroy(err);
    });
    archive.pipe(passThrough);

    const plannedEntries = records.map((paper) =>
      formatZipEntryPath(
        {
          branchCode: paper.branchCode,
          yearOfStudy: paper.yearOfStudy,
          semester: paper.semester,
          subjectCode: paper.subjectCode,
          subjectName: paper.subjectName,
          examType: paper.examType as ExamTypeValue,
          examMonth: paper.examMonth,
          examYear: paper.examYear,
          setLabel: paper.setLabel,
        },
        paper.id
      )
    );

    // Stream each PDF sequentially into ZipArchive so memory stays bounded
    void (async () => {
      try {
        for (let i = 0; i < records.length; i++) {
          const fileStream = await this.storage.getObjectStream(records[i].storageKey);
          archive.append(fileStream, { name: plannedEntries[i] });
        }
        await archive.finalize();
      } catch (err) {
        passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    const filterHint =
      "filter" in input && input.filter.year
        ? `BTech_Y${input.filter.year}${input.filter.sem ? `_S${input.filter.sem}` : ""}${input.filter.examType ? `_${input.filter.examType}` : ""}_Papers.zip`
        : "BTech_Question_Papers.zip";

    return {
      stream: passThrough,
      filename: filterHint,
      includedCount: records.length,
      entries: plannedEntries,
    };
  }
}

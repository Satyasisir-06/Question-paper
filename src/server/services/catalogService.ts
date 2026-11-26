import type { AppDb } from "@/server/db/client";
import { CatalogRepository } from "@/server/repositories/catalogRepo";
import { isValidYearSemesterPair } from "@/lib/btech";

export class CatalogService {
  private readonly repo: CatalogRepository;

  constructor(db: AppDb) {
    this.repo = new CatalogRepository(db);
  }

  getCatalog() {
    return this.repo.getPublicFilterCatalog();
  }

  createBranch(code: string, name: string) {
    return this.repo.createBranch(code, name);
  }

  createRegulation(code: string, startYear: number) {
    return this.repo.createRegulation(code, startYear);
  }

  createSubject(input: {
    code: string;
    name: string;
    branchId: string;
    regulationId: string;
    yearOfStudy: number;
    semester: number;
    isCommonFirstYear?: boolean;
  }) {
    return this.repo.createSubject(input);
  }

  updateSubject(input: { id: string; code?: string; name: string }) {
    return this.repo.updateSubject(input);
  }

  /** Import B.Tech subjects from CSV lines: code,name,branchCode,regulationCode,yearOfStudy,semester */
  async importSubjectsFromCsv(csvText: string): Promise<{
    inserted: number;
    skipped: string[];
  }> {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return { inserted: 0, skipped: [] };
    }

    const [branchRows, regRows] = await Promise.all([
      this.repo.listBranches(),
      this.repo.listRegulations(),
    ]);
    const branchByCode = new Map(branchRows.map((b) => [b.code.toUpperCase(), b]));
    const regByCode = new Map(regRows.map((r) => [r.code.toUpperCase(), r]));

    let inserted = 0;
    const skipped: string[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (idx === 0 && line.toLowerCase().startsWith("code,")) continue;

      const cols = line.split(",").map((c) => c.trim());
      if (cols.length < 6) {
        skipped.push(`Line ${idx + 1}: expected 6 comma-separated columns`);
        continue;
      }

      const [code, name, branchCode, regCode, yearStr, semStr] = cols;
      const year = Number(yearStr);
      const sem = Number(semStr);
      const branch = branchByCode.get(branchCode.toUpperCase());
      const reg = regByCode.get(regCode.toUpperCase());

      if (!code || !name || !branch || !reg || !isValidYearSemesterPair(year, sem)) {
        skipped.push(
          `Line ${idx + 1} (${code || "unknown"}): invalid branch, regulation, or year/semester pair`
        );
        continue;
      }

      await this.repo.findOrCreateSubject({
        code,
        name,
        branchId: branch.id,
        regulationId: reg.id,
        yearOfStudy: year,
        semester: sem,
      });
      inserted += 1;
    }

    return { inserted, skipped };
  }
}

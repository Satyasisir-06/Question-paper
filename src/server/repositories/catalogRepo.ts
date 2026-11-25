import { and, asc, eq } from "drizzle-orm";
import type { AppDb } from "@/server/db/client";
import { branches, papers, regulations, subjects } from "@/server/db/schema";

export interface FilterCatalogData {
  branches: Array<{ id: string; code: string; name: string }>;
  regulations: Array<{ id: string; code: string; startYear: number }>;
  subjects: Array<{
    id: string;
    code: string;
    name: string;
    branchId: string;
    regulationId: string;
    yearOfStudy: number;
    semester: number;
    isCommonFirstYear: boolean;
  }>;
  examYears: number[];
}

export class CatalogRepository {
  constructor(private readonly db: AppDb) {}

  async getPublicFilterCatalog(): Promise<FilterCatalogData> {
    const [branchRows, regRows, subjectRows, yearRows] = await Promise.all([
      this.db
        .select({
          id: branches.id,
          code: branches.code,
          name: branches.name,
        })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(asc(branches.code)),
      this.db
        .select({
          id: regulations.id,
          code: regulations.code,
          startYear: regulations.startYear,
        })
        .from(regulations)
        .where(eq(regulations.isActive, true))
        .orderBy(asc(regulations.startYear)),
      this.db
        .select({
          id: subjects.id,
          code: subjects.code,
          name: subjects.name,
          branchId: subjects.branchId,
          regulationId: subjects.regulationId,
          yearOfStudy: subjects.yearOfStudy,
          semester: subjects.semester,
          isCommonFirstYear: subjects.isCommonFirstYear,
        })
        .from(subjects)
        .orderBy(asc(subjects.yearOfStudy), asc(subjects.semester), asc(subjects.code)),
      this.db
        .selectDistinct({ examYear: papers.examYear })
        .from(papers)
        .where(eq(papers.status, "APPROVED")),
    ]);

    const examYears = yearRows
      .map((r) => r.examYear)
      .sort((a, b) => b - a);

    return {
      branches: branchRows,
      regulations: regRows,
      subjects: subjectRows,
      examYears,
    };
  }

  async createBranch(code: string, name: string) {
    const [row] = await this.db
      .insert(branches)
      .values({ code: code.toUpperCase(), name })
      .returning();
    return row;
  }

  async createRegulation(code: string, startYear: number) {
    const [row] = await this.db
      .insert(regulations)
      .values({ code: code.toUpperCase(), startYear })
      .returning();
    return row;
  }

  async createSubject(input: {
    code: string;
    name: string;
    branchId: string;
    regulationId: string;
    yearOfStudy: number;
    semester: number;
    isCommonFirstYear?: boolean;
  }) {
    const [row] = await this.db
      .insert(subjects)
      .values({
        code: input.code.toUpperCase(),
        name: input.name,
        branchId: input.branchId,
        regulationId: input.regulationId,
        yearOfStudy: input.yearOfStudy,
        semester: input.semester,
        isCommonFirstYear: input.isCommonFirstYear ?? input.yearOfStudy === 1,
      })
      .returning();
    return row;
  }

  async findOrCreateSubject(input: {
    code: string;
    name: string;
    branchId: string;
    regulationId: string;
    yearOfStudy: number;
    semester: number;
  }) {
    const normalizedCode = input.code.trim().toUpperCase();
    const existing = await this.db
      .select()
      .from(subjects)
      .where(
        and(
          eq(subjects.code, normalizedCode),
          eq(subjects.branchId, input.branchId),
          eq(subjects.regulationId, input.regulationId)
        )
      );

    if (existing[0]) return existing[0];
    return this.createSubject({
      ...input,
      code: normalizedCode,
    });
  }

  async listBranches() {
    return this.db.select().from(branches).orderBy(asc(branches.code));
  }

  async listRegulations() {
    return this.db.select().from(regulations).orderBy(asc(regulations.startYear));
  }
}

import { count } from "drizzle-orm";
import type { AppDb } from "./client";
import { branches, regulations, subjects, users } from "./schema";
import { hashPassword } from "@/server/auth/session";
import { cleanEnvValue } from "@/lib/env";

export const DEFAULT_BRANCHES = [
  { code: "CAI", name: "CSE (Artificial Intelligence)" },
  { code: "CSM", name: "CSE (Artificial Intelligence & Machine Learning)" },
  { code: "CSD", name: "CSE (Data Science)" },
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "ECE", name: "Electronics & Communication Engineering" },
  { code: "EEE", name: "Electrical & Electronics Engineering" },
  { code: "MECH", name: "Mechanical Engineering" },
  { code: "CIVI", name: "Civil Engineering" },
  { code: "COMMON", name: "Basic Sciences & Humanities (1st Year)" },
] as const;

export const DEFAULT_REGULATIONS = [
  { code: "R23", startYear: 2023 },
  { code: "R22", startYear: 2022 },
  { code: "R20", startYear: 2020 },
] as const;

export interface SeedSubjectSpec {
  code: string;
  name: string;
  branchCode: string;
  regulationCode: string;
  yearOfStudy: number;
  semester: number;
  isCommonFirstYear?: boolean;
}

export const DEFAULT_SUBJECTS: SeedSubjectSpec[] = [
  { code: "MA101", name: "Linear Algebra and Calculus", branchCode: "COMMON", regulationCode: "R23", yearOfStudy: 1, semester: 1, isCommonFirstYear: true },
  { code: "CS102", name: "Introduction to Programming", branchCode: "COMMON", regulationCode: "R23", yearOfStudy: 1, semester: 1, isCommonFirstYear: true },
  { code: "MA102", name: "Differential Equations and Vector Calculus", branchCode: "COMMON", regulationCode: "R23", yearOfStudy: 1, semester: 2, isCommonFirstYear: true },
  { code: "PH102", name: "Engineering Physics", branchCode: "COMMON", regulationCode: "R23", yearOfStudy: 1, semester: 2, isCommonFirstYear: true },
  { code: "CS201", name: "Data Structures", branchCode: "CSE", regulationCode: "R22", yearOfStudy: 2, semester: 3 },
  { code: "CS202", name: "Discrete Mathematics", branchCode: "CSE", regulationCode: "R22", yearOfStudy: 2, semester: 3 },
  { code: "CS401", name: "Database Management Systems", branchCode: "CSE", regulationCode: "R22", yearOfStudy: 2, semester: 4 },
  { code: "CS402", name: "Operating Systems", branchCode: "CSE", regulationCode: "R22", yearOfStudy: 2, semester: 4 },
  { code: "EC301", name: "Signals and Systems", branchCode: "ECE", regulationCode: "R22", yearOfStudy: 2, semester: 3 },
  { code: "EC402", name: "Analog and Digital Communications", branchCode: "ECE", regulationCode: "R22", yearOfStudy: 2, semester: 4 },
  { code: "CS501", name: "Computer Networks", branchCode: "CSE", regulationCode: "R22", yearOfStudy: 3, semester: 5 },
  { code: "CS502", name: "Formal Languages and Automata Theory", branchCode: "CSE", regulationCode: "R22", yearOfStudy: 3, semester: 5 },
  { code: "CS601", name: "Compiler Design", branchCode: "CSE", regulationCode: "R20", yearOfStudy: 3, semester: 6 },
  { code: "AI602", name: "Machine Learning Foundations", branchCode: "CAI", regulationCode: "R22", yearOfStudy: 3, semester: 6 },
  { code: "SM501", name: "Neural Networks and Deep Learning", branchCode: "CSM", regulationCode: "R22", yearOfStudy: 3, semester: 5 },
  { code: "DS502", name: "Big Data Analytics", branchCode: "CSD", regulationCode: "R22", yearOfStudy: 3, semester: 5 },
  { code: "ME501", name: "Heat Transfer", branchCode: "MECH", regulationCode: "R20", yearOfStudy: 3, semester: 5 },
  { code: "EE401", name: "Power Systems I", branchCode: "EEE", regulationCode: "R22", yearOfStudy: 2, semester: 4 },
  { code: "CE601", name: "Structural Analysis II", branchCode: "CIVI", regulationCode: "R20", yearOfStudy: 3, semester: 6 },
  { code: "CS701", name: "Cloud Computing", branchCode: "CSE", regulationCode: "R20", yearOfStudy: 4, semester: 7 },
  { code: "CS801", name: "Distributed Systems", branchCode: "CSE", regulationCode: "R20", yearOfStudy: 4, semester: 8 },
];

/**
 * Idempotently ensure baseline B.Tech branches, regulations, starter subjects,
 * and optional configured admin account exist on empty remote PostgreSQL deployments.
 */
export async function ensureCoreCatalog(db: AppDb): Promise<void> {
  const existingBranches = await db.select({ value: count() }).from(branches);
  if ((existingBranches[0]?.value ?? 0) === 0) {
    await db
      .insert(branches)
      .values(DEFAULT_BRANCHES.map((b) => ({ code: b.code, name: b.name })))
      .onConflictDoNothing();

    await db
      .insert(regulations)
      .values(
        DEFAULT_REGULATIONS.map((r) => ({ code: r.code, startYear: r.startYear }))
      )
      .onConflictDoNothing();

    const [branchRows, regRows] = await Promise.all([
      db.select().from(branches),
      db.select().from(regulations),
    ]);
    const branchByCode = new Map(branchRows.map((b) => [b.code, b]));
    const regByCode = new Map(regRows.map((r) => [r.code, r]));

    const subjectValues = DEFAULT_SUBJECTS.flatMap((s) => {
      const branch = branchByCode.get(s.branchCode);
      const reg = regByCode.get(s.regulationCode);
      if (!branch || !reg) return [];
      return [
        {
          code: s.code,
          name: s.name,
          branchId: branch.id,
          regulationId: reg.id,
          yearOfStudy: s.yearOfStudy,
          semester: s.semester,
          isCommonFirstYear: s.isCommonFirstYear ?? false,
        },
      ];
    });

    if (subjectValues.length > 0) {
      await db.insert(subjects).values(subjectValues).onConflictDoNothing();
    }
  }

  const configuredEmail = cleanEnvValue(process.env.ADMIN_SEED_EMAIL).toLowerCase();
  const configuredPassword = cleanEnvValue(process.env.ADMIN_SEED_PASSWORD);
  if (configuredEmail && configuredPassword) {
    const existingUsers = await db.select({ value: count() }).from(users);
    if ((existingUsers[0]?.value ?? 0) === 0) {
      const passwordHash = await hashPassword(configuredPassword);
      await db
        .insert(users)
        .values({
          email: configuredEmail,
          name: cleanEnvValue(process.env.ADMIN_SEED_NAME) || "Exam Cell Admin",
          passwordHash,
          role: "ADMIN",
        })
        .onConflictDoNothing();
    }
  }
}

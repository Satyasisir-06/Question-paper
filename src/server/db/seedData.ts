import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { count, eq } from "drizzle-orm";
import type { AppDb } from "./client";
import { branches, papers, regulations, subjects, users } from "./schema";
import { hashPassword } from "@/server/auth/session";
import { computeSha256 } from "@/server/validators/pdfValidator";
import type { StorageProvider } from "@/server/storage";
import { EXAM_TYPE_META, formatExamMonth, formatYearSemCode, type ExamTypeValue } from "@/lib/btech";

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

interface SeedSubjectSpec {
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

interface SamplePaperSpec {
  trackingCode: string;
  subjectCode: string;
  examType: ExamTypeValue;
  examMonth: number;
  examYear: number;
  setLabel?: string;
  status: "APPROVED" | "PENDING";
  downloadCount: number;
  viewCount: number;
  uploaderName: string;
}

const SAMPLE_PAPERS: SamplePaperSpec[] = [
  { trackingCode: "PV-1101A1", subjectCode: "MA101", examType: "REGULAR", examMonth: 1, examYear: 2024, setLabel: "Set 1", status: "APPROVED", downloadCount: 142, viewCount: 310, uploaderName: "Exam Cell" },
  { trackingCode: "PV-1102B2", subjectCode: "MA101", examType: "SUPPLY", examMonth: 7, examYear: 2024, status: "APPROVED", downloadCount: 98, viewCount: 205, uploaderName: "Exam Cell" },
  { trackingCode: "PV-1201C3", subjectCode: "PH102", examType: "REGULAR", examMonth: 6, examYear: 2024, status: "APPROVED", downloadCount: 74, viewCount: 162, uploaderName: "Exam Cell" },
  { trackingCode: "PV-2101D4", subjectCode: "CS201", examType: "REGULAR", examMonth: 12, examYear: 2024, status: "APPROVED", downloadCount: 215, viewCount: 490, uploaderName: "Exam Cell" },
  { trackingCode: "PV-2102E5", subjectCode: "CS201", examType: "SUPPLY", examMonth: 6, examYear: 2024, status: "APPROVED", downloadCount: 164, viewCount: 350, uploaderName: "Ananya R." },
  { trackingCode: "PV-2201F6", subjectCode: "CS401", examType: "REGULAR", examMonth: 5, examYear: 2024, setLabel: "Set A", status: "APPROVED", downloadCount: 261, viewCount: 530, uploaderName: "Exam Cell" },
  { trackingCode: "PV-2202G7", subjectCode: "CS401", examType: "SUPPLY", examMonth: 11, examYear: 2024, status: "APPROVED", downloadCount: 189, viewCount: 412, uploaderName: "Karthik V." },
  { trackingCode: "PV-2203H8", subjectCode: "CS402", examType: "SUPPLY", examMonth: 11, examYear: 2024, status: "APPROVED", downloadCount: 133, viewCount: 280, uploaderName: "Exam Cell" },
  { trackingCode: "PV-2204I9", subjectCode: "EC402", examType: "REGULAR", examMonth: 5, examYear: 2024, status: "APPROVED", downloadCount: 88, viewCount: 175, uploaderName: "Exam Cell" },
  { trackingCode: "PV-3101J0", subjectCode: "CS501", examType: "REGULAR", examMonth: 12, examYear: 2024, status: "APPROVED", downloadCount: 176, viewCount: 365, uploaderName: "Exam Cell" },
  { trackingCode: "PV-3201K1", subjectCode: "CS601", examType: "SUPPLY", examMonth: 11, examYear: 2023, status: "APPROVED", downloadCount: 119, viewCount: 244, uploaderName: "Srinivas K." },
  { trackingCode: "PV-3202L2", subjectCode: "AI602", examType: "REGULAR", examMonth: 5, examYear: 2024, status: "APPROVED", downloadCount: 105, viewCount: 229, uploaderName: "Exam Cell" },
  { trackingCode: "PV-3102L3", subjectCode: "SM501", examType: "REGULAR", examMonth: 12, examYear: 2024, status: "APPROVED", downloadCount: 94, viewCount: 201, uploaderName: "Exam Cell" },
  { trackingCode: "PV-3103L4", subjectCode: "DS502", examType: "SUPPLY", examMonth: 6, examYear: 2024, status: "APPROVED", downloadCount: 83, viewCount: 179, uploaderName: "Exam Cell" },
  { trackingCode: "PV-3104L6", subjectCode: "ME501", examType: "REGULAR", examMonth: 12, examYear: 2024, status: "APPROVED", downloadCount: 69, viewCount: 152, uploaderName: "Exam Cell" },
  { trackingCode: "PV-2205L7", subjectCode: "EE401", examType: "SUPPLY", examMonth: 11, examYear: 2024, status: "APPROVED", downloadCount: 91, viewCount: 187, uploaderName: "Exam Cell" },
  { trackingCode: "PV-3203L5", subjectCode: "CE601", examType: "REGULAR", examMonth: 5, examYear: 2024, status: "APPROVED", downloadCount: 77, viewCount: 168, uploaderName: "Exam Cell" },
  { trackingCode: "PV-4101M3", subjectCode: "CS701", examType: "REGULAR", examMonth: 11, examYear: 2024, status: "APPROVED", downloadCount: 92, viewCount: 194, uploaderName: "Exam Cell" },
  { trackingCode: "PV-4201N4", subjectCode: "CS801", examType: "SUPPLY", examMonth: 8, examYear: 2024, status: "APPROVED", downloadCount: 64, viewCount: 141, uploaderName: "Divya M." },
  // Pending moderation items for Admin Workbench
  { trackingCode: "PV-PEND01", subjectCode: "CS402", examType: "REGULAR", examMonth: 5, examYear: 2025, status: "PENDING", downloadCount: 0, viewCount: 0, uploaderName: "Rohan Sharma" },
  { trackingCode: "PV-PEND02", subjectCode: "EC301", examType: "SUPPLY", examMonth: 12, examYear: 2024, status: "PENDING", downloadCount: 0, viewCount: 0, uploaderName: "Priya Nair" },
];

/** Generate a realistic 2-page B.Tech question paper PDF document in memory. */
export async function generateSampleQuestionPaperPdf(params: {
  subjectCode: string;
  subjectName: string;
  branchCode: string;
  regulationCode: string;
  yearOfStudy: number;
  semester: number;
  examType: ExamTypeValue;
  examMonth: number;
  examYear: number;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const yearSem = formatYearSemCode(params.yearOfStudy, params.semester);
  const examLabel = EXAM_TYPE_META[params.examType].label;
  const session = `${formatExamMonth(params.examMonth)} ${params.examYear}`;

  const page1 = doc.addPage([595, 842]);
  page1.drawText("B.TECH DEGREE EXAMINATION", {
    x: 165,
    y: 785,
    size: 15,
    font: bold,
    color: rgb(0.09, 0.09, 0.11),
  });
  page1.drawText(
    `Year/Sem: ${yearSem} (Sem ${params.semester})   |   Branch: ${params.branchCode}   |   Regulation: ${params.regulationCode}`,
    { x: 64, y: 758, size: 10.5, font: regular, color: rgb(0.25, 0.25, 0.3) }
  );
  page1.drawText(`${params.subjectCode} - ${params.subjectName}`, {
    x: 64,
    y: 730,
    size: 13,
    font: bold,
    color: rgb(0.09, 0.09, 0.11),
  });
  page1.drawText(`Exam Category: ${examLabel}   |   Session: ${session}   |   Max Marks: 70`, {
    x: 64,
    y: 708,
    size: 10.5,
    font: bold,
    color: rgb(0.15, 0.39, 0.92),
  });

  page1.drawLine({
    start: { x: 64, y: 694 },
    end: { x: 531, y: 694 },
    thickness: 1,
    color: rgb(0.82, 0.84, 0.88),
  });

  page1.drawText("PART A - Short Answer Questions (10 x 2 = 20 Marks)", {
    x: 64,
    y: 668,
    size: 11.5,
    font: bold,
  });

  const partA = [
    "1. Define the core architectural trade-offs discussed in Unit I.",
    "2. Differentiate theoretical complexity from empirical throughput.",
    "3. State two primary design invariants for fault-resilient systems.",
    "4. Sketch the canonical state transition diagram and label all guards.",
    "5. Compare regular boundary conditions with worst-case constraints.",
  ];
  partA.forEach((line, idx) => {
    page1.drawText(line, { x: 68, y: 640 - idx * 24, size: 10, font: regular });
  });

  page1.drawText("PART B - Essay Questions (5 x 10 = 50 Marks)", {
    x: 64,
    y: 492,
    size: 11.5,
    font: bold,
  });
  const partB = [
    "6. (a) Derive the canonical algorithm and analyze time and space bounds.",
    "    (b) Illustrate step-by-step execution on a non-trivial input trace.",
    "7. (a) Explain normalization and design guarantees with a worked schema.",
    "    (b) Compare synchronization primitives under concurrent load.",
  ];
  partB.forEach((line, idx) => {
    page1.drawText(line, { x: 68, y: 462 - idx * 24, size: 10, font: regular });
  });

  const page2 = doc.addPage([595, 842]);
  page2.drawText(`${params.subjectCode} (${examLabel} - ${session}) — Page 2`, {
    x: 64,
    y: 785,
    size: 11,
    font: bold,
  });
  page2.drawText(
    "8. Discuss architectural scaling bottlenecks and mitigation patterns in detail.",
    { x: 68, y: 745, size: 10, font: regular }
  );
  page2.drawText(
    "9. Evaluate trade-offs between consistency, latency, and throughput.",
    { x: 68, y: 715, size: 10, font: regular }
  );

  return doc.save();
}

/** Seed branches, regulations, subjects, admin user, and sample papers if database is empty. */
export async function seedDatabase(
  db: AppDb,
  storage?: StorageProvider
): Promise<void> {
  const existingBranches = await db.select({ value: count() }).from(branches);
  if ((existingBranches[0]?.value ?? 0) > 0) {
    return;
  }

  const branchRows = await db
    .insert(branches)
    .values(DEFAULT_BRANCHES.map((b) => ({ code: b.code, name: b.name })))
    .returning();
  const branchByCode = new Map(branchRows.map((b) => [b.code, b]));

  const regRows = await db
    .insert(regulations)
    .values(DEFAULT_REGULATIONS.map((r) => ({ code: r.code, startYear: r.startYear })))
    .returning();
  const regByCode = new Map(regRows.map((r) => [r.code, r]));

  const subjectRows = await db
    .insert(subjects)
    .values(
      DEFAULT_SUBJECTS.map((s) => ({
        code: s.code,
        name: s.name,
        branchId: branchByCode.get(s.branchCode)!.id,
        regulationId: regByCode.get(s.regulationCode)!.id,
        yearOfStudy: s.yearOfStudy,
        semester: s.semester,
        isCommonFirstYear: s.isCommonFirstYear ?? false,
      }))
    )
    .returning();
  const subjectByCode = new Map(subjectRows.map((s) => [s.code, s]));

  const adminEmail = process.env.ADMIN_SEED_EMAIL?.trim() || "admin@college.edu";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD?.trim() || "Admin@12345";
  const adminName = process.env.ADMIN_SEED_NAME?.trim() || "Exam Cell Admin";
  const passwordHash = await hashPassword(adminPassword);

  const [adminUser] = await db
    .insert(users)
    .values({
      email: adminEmail.toLowerCase(),
      name: adminName,
      passwordHash,
      role: "ADMIN",
    })
    .returning();

  if (!storage) return;

  for (const spec of SAMPLE_PAPERS) {
    const subj = subjectByCode.get(spec.subjectCode);
    if (!subj) continue;
    const branch = branchRows.find((b) => b.id === subj.branchId)!;
    const reg = regRows.find((r) => r.id === subj.regulationId)!;

    const pdfBytes = await generateSampleQuestionPaperPdf({
      subjectCode: subj.code,
      subjectName: subj.name,
      branchCode: branch.code,
      regulationCode: reg.code,
      yearOfStudy: subj.yearOfStudy,
      semester: subj.semester,
      examType: spec.examType,
      examMonth: spec.examMonth,
      examYear: spec.examYear,
    });

    const sha256Hash = computeSha256(pdfBytes);
    const storageKey =
      spec.status === "APPROVED"
        ? `published/${branch.code}/${subj.yearOfStudy}-${subj.semester}/${spec.examType}/${subj.code}_${spec.examYear}_${spec.trackingCode}.pdf`
        : `quarantine/${spec.trackingCode}.pdf`;

    await storage.putObject(storageKey, pdfBytes, "application/pdf");

    await db.insert(papers).values({
      trackingCode: spec.trackingCode,
      subjectId: subj.id,
      branchId: branch.id,
      regulationId: reg.id,
      yearOfStudy: subj.yearOfStudy,
      semester: subj.semester,
      examType: spec.examType,
      examMonth: spec.examMonth,
      examYear: spec.examYear,
      setLabel: spec.setLabel ?? null,
      storageKey,
      originalFilename: `${subj.code}_${spec.examYear}.pdf`,
      fileSizeBytes: pdfBytes.byteLength,
      pageCount: 2,
      sha256Hash,
      status: spec.status,
      uploaderName: spec.uploaderName,
      reviewedBy: spec.status === "APPROVED" ? adminUser.id : null,
      reviewedAt: spec.status === "APPROVED" ? new Date() : null,
      downloadCount: spec.downloadCount,
      viewCount: spec.viewCount,
    });
  }
}

/** Synchronize college default branches (CAI, CSM, CSD, EEE, ECE, CIVI, MECH, CSE, COMMON) on existing DBs. */
export async function syncDefaultBranches(db: AppDb): Promise<void> {
  const existing = await db.select().from(branches);
  const byCode = new Map(existing.map((b) => [b.code.toUpperCase(), b]));

  const legacyCivil = byCode.get("CIVIL");
  if (legacyCivil && !byCode.has("CIVI")) {
    const [updated] = await db
      .update(branches)
      .set({ code: "CIVI", name: "Civil Engineering", isActive: true })
      .where(eq(branches.id, legacyCivil.id))
      .returning();
    byCode.delete("CIVIL");
    if (updated) byCode.set("CIVI", updated);
  }

  for (const deprecatedCode of ["IT", "AIML"]) {
    const oldBranch = byCode.get(deprecatedCode);
    if (oldBranch && oldBranch.isActive) {
      await db
        .update(branches)
        .set({ isActive: false })
        .where(eq(branches.id, oldBranch.id));
    }
  }

  for (const spec of DEFAULT_BRANCHES) {
    const current = byCode.get(spec.code);
    if (!current) {
      await db.insert(branches).values({
        code: spec.code,
        name: spec.name,
        isActive: true,
      });
    } else if (!current.isActive || current.name !== spec.name) {
      await db
        .update(branches)
        .set({ name: spec.name, isActive: true })
        .where(eq(branches.id, current.id));
    }
  }
}

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

  const configuredEmail = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_SEED_PASSWORD?.trim();
  if (configuredEmail && configuredPassword) {
    const existingUsers = await db.select({ value: count() }).from(users);
    if ((existingUsers[0]?.value ?? 0) === 0) {
      const passwordHash = await hashPassword(configuredPassword);
      await db
        .insert(users)
        .values({
          email: configuredEmail,
          name: process.env.ADMIN_SEED_NAME?.trim() || "Exam Cell Admin",
          passwordHash,
          role: "ADMIN",
        })
        .onConflictDoNothing();
    }
  }
}

/** Ensure admin user exists without wiping existing papers. */
export async function ensureAdminUser(db: AppDb): Promise<void> {
  const email = (process.env.ADMIN_SEED_EMAIL?.trim() || "admin@college.edu").toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) return;

  const passwordHash = await hashPassword(
    process.env.ADMIN_SEED_PASSWORD?.trim() || "Admin@12345"
  );
  await db
    .insert(users)
    .values({
      email,
      name: process.env.ADMIN_SEED_NAME?.trim() || "Exam Cell Admin",
      passwordHash,
      role: "ADMIN",
    })
    .onConflictDoNothing();
}

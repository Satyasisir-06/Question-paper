export type ExamTypeValue = "REGULAR" | "SUPPLY" | "MID_1" | "MID_2";
export type PaperStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

export const YEAR_SEM_OPTIONS = [
  { year: 1, sem: 1, code: "1-1", label: "Year 1 · Sem 1" },
  { year: 1, sem: 2, code: "1-2", label: "Year 1 · Sem 2" },
  { year: 2, sem: 3, code: "2-1", label: "Year 2 · Sem 3" },
  { year: 2, sem: 4, code: "2-2", label: "Year 2 · Sem 4" },
  { year: 3, sem: 5, code: "3-1", label: "Year 3 · Sem 5" },
  { year: 3, sem: 6, code: "3-2", label: "Year 3 · Sem 6" },
  { year: 4, sem: 7, code: "4-1", label: "Year 4 · Sem 7" },
  { year: 4, sem: 8, code: "4-2", label: "Year 4 · Sem 8" },
] as const;

export const EXAM_TYPE_META: Record<
  ExamTypeValue,
  { label: string; shortLabel: string; folderName: string }
> = {
  REGULAR: { label: "Regular", shortLabel: "Regular", folderName: "Regular" },
  SUPPLY: { label: "Supply", shortLabel: "Supply", folderName: "Supply" },
  MID_1: { label: "Midterm 1", shortLabel: "Mid 1", folderName: "Midterm_1" },
  MID_2: { label: "Midterm 2", shortLabel: "Mid 2", folderName: "Midterm_2" },
};

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Return the two valid B.Tech semesters (1..8) for an academic year (1..4). */
export function getSemestersForYear(year: number): [number, number] {
  if (!Number.isInteger(year) || year < 1 || year > 4) {
    throw new RangeError(`Academic year must be between 1 and 4, received ${year}`);
  }
  return [year * 2 - 1, year * 2];
}

/** Return the academic year (1..4) for a semester (1..8). */
export function getYearForSemester(semester: number): number {
  if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
    throw new RangeError(`Semester must be between 1 and 8, received ${semester}`);
  }
  return Math.ceil(semester / 2);
}

/** Check whether a year (1..4) and semester (1..8) pair is valid in B.Tech structure. */
export function isValidYearSemesterPair(year: number, semester: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(semester)) return false;
  if (year < 1 || year > 4 || semester < 1 || semester > 8) return false;
  const [firstSem, secondSem] = getSemestersForYear(year);
  return semester === firstSem || semester === secondSem;
}

/** Format canonical B.Tech Year-Sem code such as "2-2" for Year 2, Semester 4. */
export function formatYearSemCode(year: number, semester: number): string {
  if (!isValidYearSemesterPair(year, semester)) {
    throw new RangeError(`Invalid Year (${year}) and Semester (${semester}) pair`);
  }
  const semInYear = semester % 2 === 1 ? 1 : 2;
  return `${year}-${semInYear}`;
}

/** Format 1..12 exam month into three-letter abbreviation. */
export function formatExamMonth(month: number): string {
  const index = Math.max(1, Math.min(12, Math.trunc(month))) - 1;
  return MONTH_ABBR[index];
}

/** Format byte size into readable KB or MB string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip path traversal, control characters, and unsafe filename characters. */
export function sanitizePathSegment(input: string): string {
  const cleaned = input
    .replace(/[\r\n\t\0]/g, "_")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "")
    .replace(/_+/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "item";
}

export interface PaperPathMeta {
  branchCode: string;
  yearOfStudy: number;
  semester: number;
  subjectCode: string;
  subjectName: string;
  examType: ExamTypeValue;
  examMonth: number;
  examYear: number;
  setLabel?: string | null;
}

/** Build standardized PDF download filename without unsafe header/path characters. */
export function formatPaperFilename(meta: PaperPathMeta): string {
  const branch = sanitizePathSegment(meta.branchCode);
  const yearSem = formatYearSemCode(meta.yearOfStudy, meta.semester);
  const code = sanitizePathSegment(meta.subjectCode);
  const name = sanitizePathSegment(meta.subjectName);
  const exam = EXAM_TYPE_META[meta.examType]?.folderName ?? "Regular";
  const session = `${formatExamMonth(meta.examMonth)}${meta.examYear}`;
  const setPart = meta.setLabel ? `_${sanitizePathSegment(meta.setLabel)}` : "";

  return `${branch}_${yearSem}_${code}_${name}_${exam}_${session}${setPart}.pdf`;
}

/** Build structured folder entry path inside a ZIP download archive. */
export function formatZipEntryPath(meta: PaperPathMeta, shortId: string): string {
  const branch = sanitizePathSegment(meta.branchCode);
  const code = sanitizePathSegment(meta.subjectCode);
  const name = sanitizePathSegment(meta.subjectName);
  const examFolder = EXAM_TYPE_META[meta.examType]?.folderName ?? "Regular";
  const session = `${formatExamMonth(meta.examMonth)}${meta.examYear}`;
  const setPart = meta.setLabel ? `_${sanitizePathSegment(meta.setLabel)}` : "";
  const idSuffix = sanitizePathSegment(shortId.slice(0, 8));

  return `BTech_Papers/Year_${meta.yearOfStudy}_Sem_${meta.semester}/${branch}/${examFolder}/${code}_${name}_${session}${setPart}_${idSuffix}.pdf`;
}

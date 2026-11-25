import { isValidYearSemesterPair, type ExamTypeValue } from "@/lib/btech";
import type { FilterCatalogDto } from "@/types/paper";

export interface ScannedPaperMetadata {
  matchedCatalogSubject: boolean;
  subjectId?: string;
  subjectCode?: string;
  subjectName?: string;
  branchId?: string;
  regulationId?: string;
  yearOfStudy?: number;
  semester?: number;
  examType?: ExamTypeValue;
  examMonth?: number;
  examYear?: number;
  detectedFields: string[];
  rawTextPreview: string;
}

const MONTH_PATTERNS: Array<{ month: number; regex: RegExp }> = [
  { month: 1, regex: /\b(?:january|jan)\b/i },
  { month: 2, regex: /\b(?:february|feb)\b/i },
  { month: 3, regex: /\b(?:march|mar)\b/i },
  { month: 4, regex: /\b(?:april|apr)\b/i },
  { month: 5, regex: /\bmay\b/i },
  { month: 6, regex: /\bjune?\b/i },
  { month: 7, regex: /\bjuly?\b/i },
  { month: 8, regex: /\b(?:august|aug)\b/i },
  { month: 9, regex: /\b(?:september|sept|sep)\b/i },
  { month: 10, regex: /\b(?:october|oct)\b/i },
  { month: 11, regex: /\b(?:november|nov)\b/i },
  { month: 12, regex: /\b(?:december|dec)\b/i },
];

const EXCLUDED_CODE_WORDS = new Set([
  "PART",
  "PAGE",
  "SET",
  "TIME",
  "MAX",
  "MARKS",
  "SEM",
  "YEAR",
  "HALL",
  "NOTE",
  "CODE",
  "SUB",
  "PAPER",
  "EXAM",
  "BTECH",
  "REG",
]);

function normalizeLines(rawText: string): string[] {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/[\u00A0\u200B]+/g, " ")
    .replace(/[–—]/g, "-")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0);
}

function cleanSubjectTitle(raw: string): string {
  let cleaned = raw
    .replace(/\s*\((?:common to|r\d{2}|cai|csm|csd|cse|ece|eee|mech|civi|civil|branch)[^)]*\)\s*$/i, "")
    .replace(/\s*\|\s*(?:branch|regulation|exam|session|max\s*marks|time).*$/i, "")
    .replace(/\s*[-–]\s*page\s*\d+.*$/i, "")
    .replace(/^[-:\s]+|[-:\s]+$/g, "")
    .trim();

  // Strip stray trailing branch tag without closing info if any
  cleaned = cleaned.replace(/\s+\((?:CAI|CSM|CSD|CSE|ECE|EEE|MECH|CIVI|CIVIL)\)\s*$/i, "").trim();
  return cleaned;
}

function isLikelySubjectCode(candidate: string, regulationCodes: Set<string>): boolean {
  const upper = candidate.trim().toUpperCase();
  if (upper.length < 4 || upper.length > 16) return false;
  if (regulationCodes.has(upper)) return false;
  if (/^R\d{2}$/.test(upper)) return false;
  if (!/[A-Z]/.test(upper) || !/\d/.test(upper)) return false;
  const prefix = upper.replace(/\d.*/, "");
  if (EXCLUDED_CODE_WORDS.has(prefix)) return false;
  return true;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectBranchId(
  text: string,
  catalog: FilterCatalogDto
): string | undefined {
  const byCode = new Map(
    catalog.branches.map((b) => [b.code.toUpperCase(), b.id])
  );

  const orderedPatterns: Array<{ code: string; regex: RegExp }> = [
    {
      code: "CSM",
      regex:
        /\bCSM\b|CSE\s*[-–(\s]*(?:AI\s*(?:&|AND)\s*ML|AIML|ARTIFICIAL\s+INTELLIGENCE\s*(?:&|AND)\s*MACHINE\s+LEARNING)/i,
    },
    {
      code: "CSD",
      regex: /\bCSD\b|CSE\s*[-–(\s]*(?:DS|DATA\s+SCIENCE)/i,
    },
    {
      code: "CAI",
      regex:
        /\bCAI\b|CSE\s*[-–(\s]*(?:AI|ARTIFICIAL\s+INTELLIGENCE)(?!\s*(?:&|AND)\s*(?:ML|MACHINE))/i,
    },
    {
      code: "CIVI",
      regex: /\bCIVI\b|\bCIVIL(?:\s+ENGINEERING)?\b/i,
    },
    {
      code: "ECE",
      regex:
        /\bECE\b|ELECTRONICS\s*(?:&|AND)\s*COMMUNICATION(?:\s+ENGINEERING)?/i,
    },
    {
      code: "EEE",
      regex:
        /\bEEE\b|ELECTRICAL\s*(?:&|AND)\s*ELECTRONICS(?:\s+ENGINEERING)?/i,
    },
    {
      code: "MECH",
      regex: /\bMECH\b|MECHANICAL(?:\s+ENGINEERING)?/i,
    },
    {
      code: "CSE",
      regex:
        /\bCSE\b|COMPUTER\s+SCIENCE\s*(?:&|AND)\s*ENGINEERING/i,
    },
  ];

  for (const rule of orderedPatterns) {
    const id = byCode.get(rule.code);
    if (id && rule.regex.test(text)) {
      return id;
    }
  }

  for (const branch of catalog.branches) {
    if (branch.code === "COMMON") continue;
    const codeMatch = new RegExp(`\\b${escapeRegex(branch.code)}\\b`, "i");
    if (codeMatch.test(text)) return branch.id;
  }

  return undefined;
}

function detectRegulationId(
  text: string,
  catalog: FilterCatalogDto
): string | undefined {
  for (const reg of catalog.regulations) {
    const regex = new RegExp(
      `(?:regulation[:\\s-]*|\\(|\\b)${escapeRegex(reg.code)}(?:\\)|\\b)`,
      "i"
    );
    if (regex.test(text)) return reg.id;
  }
  return undefined;
}

function romanToNumber(roman: string): number | undefined {
  switch (roman.toUpperCase()) {
    case "IV":
      return 4;
    case "III":
      return 3;
    case "II":
      return 2;
    case "I":
      return 1;
    default:
      return undefined;
  }
}

function detectYearSem(
  text: string
): { yearOfStudy: number; semester: number } | undefined {
  // 1. Direct Year/Sem: "2-2" or "Year/Sem: 2-2 (Sem 4)"
  const codeMatch = text.match(
    /(?:year\s*\/?\s*sem(?:ester)?[:\s-]*|b\.?\s*tech[:\s-]+)([1-4])\s*[-/]\s*([12])\b/i
  );
  if (codeMatch) {
    const y = Number(codeMatch[1]);
    const semInYear = Number(codeMatch[2]);
    return { yearOfStudy: y, semester: (y - 1) * 2 + semInYear };
  }

  // 2. Roman numerals e.g. "III B.Tech I Semester", "II B.Tech - II Sem", "I B.Tech I Sem"
  const romanMatch = text.match(
    /\b(IV|III|II|I)\s*B\.?\s*TECH\b[^0-9A-Za-z\n]{0,10}(IV|III|II|I|[12])\s*(?:SEM(?:ESTER)?)\b/i
  );
  if (romanMatch) {
    const y = romanToNumber(romanMatch[1]);
    const rawSem = romanMatch[2].toUpperCase();
    const semInYear =
      rawSem === "II" || rawSem === "2"
        ? 2
        : rawSem === "I" || rawSem === "1"
          ? 1
          : undefined;
    if (y && semInYear) {
      return { yearOfStudy: y, semester: (y - 1) * 2 + semInYear };
    }
  }

  // 3. Explicit "Year X ... Sem Y (1..8)"
  const explicitYear = text.match(/\bYear\s*[:\-]?\s*([1-4])\b/i);
  const explicitSem = text.match(/\bSem(?:ester)?\s*[:\-]?\s*([1-8])\b/i);
  if (explicitYear && explicitSem) {
    const y = Number(explicitYear[1]);
    const s = Number(explicitSem[1]);
    if (isValidYearSemesterPair(y, s)) {
      return { yearOfStudy: y, semester: s };
    }
  }

  // 4. Fallback standalone N-1 / N-2 only when followed by Sem
  const shortPair = text.match(/\b([1-4])-([12])\s*(?:sem|regular|supply)/i);
  if (shortPair) {
    const y = Number(shortPair[1]);
    const semInYear = Number(shortPair[2]);
    return { yearOfStudy: y, semester: (y - 1) * 2 + semInYear };
  }

  return undefined;
}

function detectExamType(text: string): ExamTypeValue | undefined {
  if (/\bmid(?:term)?\s*[-:#]?\s*(?:2|II)\b/i.test(text)) return "MID_2";
  if (/\bmid(?:term)?\s*[-:#]?\s*(?:1|I)\b/i.test(text)) return "MID_1";
  if (/\b(?:supp(?:lementary|ly)?|arrear|re-?appear)\b/i.test(text)) {
    if (!/\bregular\s*\/\s*supplementary\b/i.test(text)) {
      return "SUPPLY";
    }
  }
  if (/\bregular\b/i.test(text)) return "REGULAR";
  return undefined;
}

function detectExamSession(
  text: string
): { examMonth?: number; examYear?: number } {
  for (const entry of MONTH_PATTERNS) {
    const regex = new RegExp(
      `(${entry.regex.source})[,\\s\\-/]*(20\\d{2})`,
      "i"
    );
    const match = text.match(regex);
    if (match) {
      const yr = Number(match[2]);
      if (yr >= 2005 && yr <= 2035) {
        return { examMonth: entry.month, examYear: yr };
      }
    }
  }

  const numericSession = text.match(/\b(0?[1-9]|1[0-2])\s*[-/]\s*(20\d{2})\b/);
  if (numericSession) {
    const m = Number(numericSession[1]);
    const y = Number(numericSession[2]);
    if (y >= 2005 && y <= 2035) {
      return { examMonth: m, examYear: y };
    }
  }

  let examMonth: number | undefined;
  for (const entry of MONTH_PATTERNS) {
    if (entry.regex.test(text)) {
      examMonth = entry.month;
      break;
    }
  }

  const yearMatch = text.match(/\b(20(?:1\d|2\d|3[0-5]))\b/);
  const examYear = yearMatch ? Number(yearMatch[1]) : undefined;
  return { examMonth, examYear };
}

function extractSubjectCode(
  text: string,
  lines: string[],
  regulationCodes: Set<string>
): string | undefined {
  // 1. Explicitly labeled subject/course code
  const labeled = text.match(
    /(?:code\s*no|subject\s*code|course\s*code|sub\.?\s*code|paper\s*code)\s*[:\-]?\s*([A-Z0-9]{4,14})\b/i
  );
  if (labeled && isLikelySubjectCode(labeled[1], regulationCodes)) {
    return labeled[1].toUpperCase();
  }

  // 2. Inline "<CODE> - <Subject Title>" anywhere in top lines
  for (const line of lines.slice(0, 15)) {
    const inline = line.match(
      /^([A-Z0-9]{4,14})\s*-\s*[A-Za-z][A-Za-z0-9\s,&()'/-]{3,}$/
    );
    if (inline && isLikelySubjectCode(inline[1], regulationCodes)) {
      return inline[1].toUpperCase();
    }
  }

  // 3. Standalone token matching typical college subject code formats like CS401, 22AM302T, CA101PC
  for (const line of lines.slice(0, 12)) {
    if (/hall\s*ticket|time\s*:|max\.?\s*marks/i.test(line)) continue;
    const matches = line.match(/\b(?:\d{2}[A-Z]{2,4}\d{2,4}[A-Z]{0,2}|[A-Z]{2,5}\d{3,4}[A-Z]{0,3})\b/g);
    if (matches) {
      for (const token of matches) {
        if (isLikelySubjectCode(token, regulationCodes)) {
          return token.toUpperCase();
        }
      }
    }
  }

  return undefined;
}

function extractSubjectName(
  text: string,
  lines: string[],
  extractedCode?: string
): string | undefined {
  // 1. Explicitly labeled Subject / Subject Name / Course Title
  const labeled = text.match(
    /(?:subject\s*name|course\s*name|course\s*title|paper\s*title|subject)\s*[:\-]\s*([^\n]+)/i
  );
  if (labeled?.[1]) {
    const cleaned = cleanSubjectTitle(labeled[1]);
    if (cleaned.length >= 3) return cleaned;
  }

  // 2. "<CODE> - <Subject Name>" line
  for (const line of lines.slice(0, 15)) {
    const inline = line.match(
      /^([A-Z0-9]{4,14})\s*-\s*([^\n]+)$/i
    );
    if (
      inline &&
      (!extractedCode || inline[1].toUpperCase() === extractedCode)
    ) {
      const candidate = cleanSubjectTitle(inline[2]);
      if (
        candidate.length >= 3 &&
        !/^(?:short\s+answer|essay\s+questions|page\s+\d)/i.test(candidate)
      ) {
        return candidate;
      }
    }
  }

  // 3. Line right after Code No / Course Code if it looks like a subject title
  const codeLineIdx = lines.findIndex((line) =>
    /(?:code\s*no|subject\s*code|course\s*code|sub\.?\s*code)/i.test(line)
  );
  if (codeLineIdx >= 0) {
    for (let idx = codeLineIdx + 1; idx < Math.min(lines.length, codeLineIdx + 4); idx++) {
      const line = lines[idx];
      if (
        /^(?:part\s*[ab]|time\s*:|max\.?\s*marks|note\s*:|branch\s*:|regulation\s*:|year\/sem|answer\s+any|i+\s+b\.?\s*tech)/i.test(
          line
        )
      ) {
        continue;
      }
      const cleaned = cleanSubjectTitle(line);
      if (cleaned.length >= 4 && /[a-zA-Z]{3,}/.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return undefined;
}

/**
 * Parse digital PDF text or OCR output into structured B.Tech question paper
 * metadata and match existing subjects, branches, and regulations when possible.
 */
export function extractPaperMetadataFromText(
  rawText: string,
  catalog: FilterCatalogDto
): ScannedPaperMetadata {
  const lines = normalizeLines(rawText);
  const normalizedText = lines.join("\n");
  const regulationCodes = new Set(
    catalog.regulations.map((r) => r.code.toUpperCase())
  );

  let branchId = detectBranchId(normalizedText, catalog);
  let regulationId = detectRegulationId(normalizedText, catalog);
  const yearSem = detectYearSem(normalizedText);
  const examType = detectExamType(normalizedText);
  const { examMonth, examYear } = detectExamSession(normalizedText);

  let matchedSubject = catalog.subjects.find((subj) => {
    const codeRegex = new RegExp(`\\b${escapeRegex(subj.code)}\\b`, "i");
    return codeRegex.test(normalizedText);
  });

  if (!matchedSubject) {
    const collapsedUpper = normalizedText.replace(/\s+/g, " ").toUpperCase();
    matchedSubject = catalog.subjects.find((subj) => {
      const nameUpper = subj.name.trim().toUpperCase();
      return nameUpper.length >= 5 && collapsedUpper.includes(nameUpper);
    });
  }

  const fallbackCode = extractSubjectCode(normalizedText, lines, regulationCodes);
  const fallbackName = extractSubjectName(normalizedText, lines, fallbackCode);

  const yearOfStudy = yearSem?.yearOfStudy ?? matchedSubject?.yearOfStudy;
  const semester = yearSem?.semester ?? matchedSubject?.semester;
  if (!branchId && matchedSubject) {
    branchId = matchedSubject.branchId;
  }
  if (!regulationId && matchedSubject) {
    regulationId = matchedSubject.regulationId;
  }

  const subjectCode = matchedSubject?.code ?? fallbackCode;
  const subjectName = matchedSubject?.name ?? fallbackName;

  const detectedFields: string[] = [];
  if (subjectCode) detectedFields.push("Subject code");
  if (subjectName) detectedFields.push("Subject name");
  if (branchId) detectedFields.push("Branch");
  if (regulationId) detectedFields.push("Regulation");
  if (yearOfStudy && semester) detectedFields.push("Year & Sem");
  if (examType) detectedFields.push("Exam category");
  if (examMonth || examYear) detectedFields.push("Exam session");

  return {
    matchedCatalogSubject: Boolean(matchedSubject),
    subjectId: matchedSubject?.id,
    subjectCode,
    subjectName,
    branchId,
    regulationId,
    yearOfStudy,
    semester,
    examType,
    examMonth,
    examYear,
    detectedFields,
    rawTextPreview: normalizedText.slice(0, 400),
  };
}

import { describe, expect, it } from "vitest";
import { extractPaperMetadataFromText } from "@/lib/paperScanner";
import type { FilterCatalogDto } from "@/types/paper";

const SAMPLE_CATALOG: FilterCatalogDto = {
  branches: [
    { id: "b-cai", code: "CAI", name: "CSE (Artificial Intelligence)" },
    { id: "b-csm", code: "CSM", name: "CSE (Artificial Intelligence & Machine Learning)" },
    { id: "b-csd", code: "CSD", name: "CSE (Data Science)" },
    { id: "b-cse", code: "CSE", name: "Computer Science & Engineering" },
    { id: "b-ece", code: "ECE", name: "Electronics & Communication Engineering" },
    { id: "b-eee", code: "EEE", name: "Electrical & Electronics Engineering" },
    { id: "b-mech", code: "MECH", name: "Mechanical Engineering" },
    { id: "b-civi", code: "CIVI", name: "Civil Engineering" },
    { id: "b-com", code: "COMMON", name: "Basic Sciences & Humanities (1st Year)" },
  ],
  regulations: [
    { id: "r-20", code: "R20", startYear: 2020 },
    { id: "r-22", code: "R22", startYear: 2022 },
    { id: "r-23", code: "R23", startYear: 2023 },
  ],
  subjects: [
    {
      id: "s-cs401",
      code: "CS401",
      name: "Database Management Systems",
      branchId: "b-cse",
      regulationId: "r-22",
      yearOfStudy: 2,
      semester: 4,
      isCommonFirstYear: false,
    },
    {
      id: "s-ec301",
      code: "EC301",
      name: "Signals and Systems",
      branchId: "b-ece",
      regulationId: "r-22",
      yearOfStudy: 2,
      semester: 3,
      isCommonFirstYear: false,
    },
    {
      id: "s-ce601",
      code: "CE601",
      name: "Structural Analysis II",
      branchId: "b-civi",
      regulationId: "r-20",
      yearOfStudy: 3,
      semester: 6,
      isCommonFirstYear: false,
    },
  ],
  examYears: [2024, 2025],
};

describe("Question paper metadata scanner (text & OCR parser)", () => {
  it("extracts catalog match and full metadata from structured B.Tech PDF header", () => {
    const text = `
      B.TECH DEGREE EXAMINATION
      Year/Sem: 2-2 (Sem 4) | Branch: CSE | Regulation: R22
      CS401 - Database Management Systems
      Exam Category: Supply | Session: Nov 2024 | Max Marks: 70
      PART A - Short Answer Questions
    `;

    const result = extractPaperMetadataFromText(text, SAMPLE_CATALOG);
    expect(result.subjectId).toBe("s-cs401");
    expect(result.subjectCode).toBe("CS401");
    expect(result.subjectName).toBe("Database Management Systems");
    expect(result.branchId).toBe("b-cse");
    expect(result.regulationId).toBe("r-22");
    expect(result.yearOfStudy).toBe(2);
    expect(result.semester).toBe(4);
    expect(result.examType).toBe("SUPPLY");
    expect(result.examMonth).toBe(11);
    expect(result.examYear).toBe(2024);
    expect(result.matchedCatalogSubject).toBe(true);
  });

  it("extracts custom subject code and name from noisy mobile OCR university exam paper", () => {
    const ocrText = `
      Code No: CS3105PC
      III B.Tech I Semester Supplementary Examinations, December - 2024
      Branch: CSE (Data Science)  (R22 Regulation)
      Subject Name: Exploratory Data Analysis
      Time: 3 Hours                               Max. Marks: 60
      Note: Answer any five questions
    `;

    const result = extractPaperMetadataFromText(ocrText, SAMPLE_CATALOG);
    expect(result.matchedCatalogSubject).toBe(false);
    expect(result.subjectCode).toBe("CS3105PC");
    expect(result.subjectName).toBe("Exploratory Data Analysis");
    expect(result.branchId).toBe("b-csd");
    expect(result.regulationId).toBe("r-22");
    expect(result.yearOfStudy).toBe(3);
    expect(result.semester).toBe(5);
    expect(result.examType).toBe("SUPPLY");
    expect(result.examMonth).toBe(12);
    expect(result.examYear).toBe(2024);
  });

  it("recognizes CIVI, CAI, CSM department labels, Roman year/sem, and Midterm exam types", () => {
    const ocrText = `
      II B.Tech - I Sem Mid-I Examination, March 2025
      Department of CSE (AI & ML)
      22AM302T - Formal Languages and Automata Theory
      Time: 90 Minutes   Max. Marks: 30
    `;

    const result = extractPaperMetadataFromText(ocrText, SAMPLE_CATALOG);
    expect(result.subjectCode).toBe("22AM302T");
    expect(result.subjectName).toBe("Formal Languages and Automata Theory");
    expect(result.branchId).toBe("b-csm");
    expect(result.yearOfStudy).toBe(2);
    expect(result.semester).toBe(3);
    expect(result.examType).toBe("MID_1");
    expect(result.examMonth).toBe(3);
    expect(result.examYear).toBe(2025);

    const civilText = `
      IV B.Tech II Sem Regular Exam May 2024
      Civil Engineering (R20)
      Sub Code: CE801
      Subject: Prestressed Concrete Structures
    `;
    const civilResult = extractPaperMetadataFromText(civilText, SAMPLE_CATALOG);
    expect(civilResult.branchId).toBe("b-civi");
    expect(civilResult.regulationId).toBe("r-20");
    expect(civilResult.yearOfStudy).toBe(4);
    expect(civilResult.semester).toBe(8);
    expect(civilResult.examType).toBe("REGULAR");
    expect(civilResult.subjectCode).toBe("CE801");
    expect(civilResult.subjectName).toBe("Prestressed Concrete Structures");
  });

  it("falls back to matching catalog subject name even when OCR misspells the subject code", () => {
    const ocrText = `
      B.TECH EXAM NOVEMBER 2024
      Structural Analysis II
      (Common to Civil Engineering)
    `;
    const result = extractPaperMetadataFromText(ocrText, SAMPLE_CATALOG);
    expect(result.matchedCatalogSubject).toBe(true);
    expect(result.subjectId).toBe("s-ce601");
    expect(result.subjectCode).toBe("CE601");
    expect(result.branchId).toBe("b-civi");
    expect(result.yearOfStudy).toBe(3);
    expect(result.semester).toBe(6);
  });

  it("extracts standalone subject code without misidentifying regulation codes or PART headers", () => {
    const ocrText = `
      I B.Tech I Sem (R23) Regular Examination, Jan 2025
      Course Code: CA101PC
      Engineering Chemistry for Artificial Intelligence (CAI)
      PART A (10 x 2 = 20 Marks)
    `;
    const result = extractPaperMetadataFromText(ocrText, SAMPLE_CATALOG);
    expect(result.subjectCode).toBe("CA101PC");
    expect(result.branchId).toBe("b-cai");
    expect(result.regulationId).toBe("r-23");
    expect(result.yearOfStudy).toBe(1);
    expect(result.semester).toBe(1);
    expect(result.examMonth).toBe(1);
    expect(result.examYear).toBe(2025);
    expect(result.subjectName).toBe("Engineering Chemistry for Artificial Intelligence");
  });

  it("handles numeric month/year, Midterm 2, Year/Sem explicit tags, standalone codes, and empty text safely", () => {
    const numericHeader = `
      B.TECH Year 4 Sem 7 Mid-II 04/2025
      Department of Mechanical Engineering
      ME701
      Power Plant Engineering
    `;
    const r1 = extractPaperMetadataFromText(numericHeader, SAMPLE_CATALOG);
    expect(r1.examType).toBe("MID_2");
    expect(r1.examMonth).toBe(4);
    expect(r1.examYear).toBe(2025);
    expect(r1.yearOfStudy).toBe(4);
    expect(r1.semester).toBe(7);

    const shortPairHeader = `
      3-2 Sem Regular June 2024
      Electrical & Electronics Engineering
      EE602 - Power Electronics
    `;
    const r2 = extractPaperMetadataFromText(shortPairHeader, SAMPLE_CATALOG);
    expect(r2.yearOfStudy).toBe(3);
    expect(r2.semester).toBe(6);
    expect(r2.examType).toBe("REGULAR");
    expect(r2.examMonth).toBe(6);
    expect(r2.subjectCode).toBe("EE602");
    expect(r2.subjectName).toBe("Power Electronics");

    const emptyRes = extractPaperMetadataFromText("   ", SAMPLE_CATALOG);
    expect(emptyRes.detectedFields).toEqual([]);
    expect(emptyRes.matchedCatalogSubject).toBe(false);
  });
});

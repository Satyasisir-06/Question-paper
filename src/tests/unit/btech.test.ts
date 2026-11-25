import { describe, expect, it } from "vitest";
import {
  formatExamMonth,
  formatFileSize,
  formatPaperFilename,
  formatYearSemCode,
  formatZipEntryPath,
  getSemestersForYear,
  getYearForSemester,
  isValidYearSemesterPair,
  sanitizePathSegment,
} from "@/lib/btech";

describe("B.Tech Year & Semester utilities", () => {
  it("maps each year 1..4 to its exact two semesters and throws out of range", () => {
    expect(getSemestersForYear(1)).toEqual([1, 2]);
    expect(getSemestersForYear(2)).toEqual([3, 4]);
    expect(getSemestersForYear(3)).toEqual([5, 6]);
    expect(getSemestersForYear(4)).toEqual([7, 8]);
    expect(() => getSemestersForYear(0)).toThrow(RangeError);
    expect(() => getSemestersForYear(5)).toThrow(RangeError);
  });

  it("maps semester 1..8 back to year 1..4 and throws out of range", () => {
    expect(getYearForSemester(1)).toBe(1);
    expect(getYearForSemester(2)).toBe(1);
    expect(getYearForSemester(3)).toBe(2);
    expect(getYearForSemester(4)).toBe(2);
    expect(getYearForSemester(5)).toBe(3);
    expect(getYearForSemester(6)).toBe(3);
    expect(getYearForSemester(7)).toBe(4);
    expect(getYearForSemester(8)).toBe(4);
    expect(() => getYearForSemester(0)).toThrow(RangeError);
    expect(() => getYearForSemester(9)).toThrow(RangeError);
  });

  it("validates year and semester pairs strictly", () => {
    expect(isValidYearSemesterPair(2, 4)).toBe(true);
    expect(isValidYearSemesterPair(2, 3)).toBe(true);
    expect(isValidYearSemesterPair(2, 1)).toBe(false);
    expect(isValidYearSemesterPair(2, 5)).toBe(false);
    expect(isValidYearSemesterPair(0, 1)).toBe(false);
    expect(isValidYearSemesterPair(5, 8)).toBe(false);
    expect(isValidYearSemesterPair(1.5, 1)).toBe(false);
  });

  it("formats canonical Year-Sem code and throws on invalid pair", () => {
    expect(formatYearSemCode(1, 1)).toBe("1-1");
    expect(formatYearSemCode(2, 4)).toBe("2-2");
    expect(formatYearSemCode(4, 7)).toBe("4-1");
    expect(formatYearSemCode(4, 8)).toBe("4-2");
    expect(() => formatYearSemCode(2, 1)).toThrow(RangeError);
  });

  it("formats byte sizes and exam months", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatExamMonth(1)).toBe("Jan");
    expect(formatExamMonth(12)).toBe("Dec");
  });

  it("sanitizes dangerous path segments against Zip Slip and header injection", () => {
    expect(sanitizePathSegment("../../etc/passwd")).toBe("etc_passwd");
    expect(sanitizePathSegment('DBMS\r\nSet-Cookie: evil=1; "bad"')).toBe(
      "DBMS_Set-Cookie_evil_1_bad"
    );
    expect(sanitizePathSegment("   ")).toBe("item");
  });

  it("formats standardized download filename and ZIP folder entry path", () => {
    const meta = {
      branchCode: "CSE",
      yearOfStudy: 2,
      semester: 4,
      subjectCode: "CS401",
      subjectName: "Database Management Systems",
      examType: "SUPPLY" as const,
      examMonth: 11,
      examYear: 2024,
      setLabel: "Set A",
    };

    expect(formatPaperFilename(meta)).toBe(
      "CSE_2-2_CS401_Database_Management_Systems_Supply_Nov2024_Set_A.pdf"
    );
    expect(formatZipEntryPath(meta, "abcd1234")).toBe(
      "BTech_Papers/Year_2_Sem_4/CSE/Supply/CS401_Database_Management_Systems_Nov2024_Set_A_abcd1234.pdf"
    );
  });
});

import type { ExamTypeValue, PaperStatusValue } from "@/lib/btech";

export interface PaperDto {
  id: string;
  trackingCode: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  regulationId: string;
  regulationCode: string;
  yearOfStudy: number;
  semester: number;
  examType: ExamTypeValue;
  examMonth: number;
  examYear: number;
  setLabel: string | null;
  fileSizeBytes: number;
  pageCount: number;
  status: PaperStatusValue;
  uploaderName: string | null;
  downloadCount: number;
  viewCount: number;
  createdAt: string;
}

export interface FilterCatalogDto {
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

export interface FolderTreeYearDto {
  yearOfStudy: number;
  label: string;
  paperCount: number;
  semesters: Array<{
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
      papers: PaperDto[];
    }>;
  }>;
}

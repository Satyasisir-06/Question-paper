import { z } from "zod";
import { isValidYearSemesterPair } from "@/lib/btech";

export const examTypeSchema = z.enum(["REGULAR", "SUPPLY", "MID_1", "MID_2"]);
export const paperStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "ARCHIVED"]);
export const sortOrderSchema = z.enum(["newest", "most_downloaded", "subject_code"]);

export const paperQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  year: z.coerce.number().int().min(1).max(4).optional(),
  sem: z.coerce.number().int().min(1).max(8).optional(),
  branch: z.string().trim().max(20).optional(),
  regulation: z.string().trim().max(20).optional(),
  examType: examTypeSchema.optional(),
  examYear: z.coerce.number().int().min(2005).max(2035).optional(),
  subjectId: z.string().uuid().optional(),
  sort: sortOrderSchema.default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export const uploadMetadataSchema = z
  .object({
    branchId: z.string().uuid("Select a valid branch."),
    regulationId: z.string().uuid("Select a valid regulation."),
    yearOfStudy: z.coerce.number().int().min(1).max(4),
    semester: z.coerce.number().int().min(1).max(8),
    subjectId: z.string().uuid().optional().or(z.literal("")),
    customSubjectCode: z.string().trim().min(2).max(24).optional().or(z.literal("")),
    customSubjectName: z.string().trim().min(3).max(160).optional().or(z.literal("")),
    examType: examTypeSchema,
    examMonth: z.coerce.number().int().min(1).max(12),
    examYear: z.coerce.number().int().min(2005).max(2035),
    setLabel: z.string().trim().max(40).optional().or(z.literal("")),
    uploaderName: z.string().trim().max(80).optional().or(z.literal("")),
    uploaderEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
    honeypot: z.string().max(0).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (!isValidYearSemesterPair(data.yearOfStudy, data.semester)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semester"],
        message: `Semester ${data.semester} does not belong to Year ${data.yearOfStudy}.`,
      });
    }
    const hasSubjectId = Boolean(data.subjectId && data.subjectId.length > 0);
    const hasCustom = Boolean(data.customSubjectCode && data.customSubjectName);
    if (!hasSubjectId && !hasCustom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjectId"],
        message: "Select an existing subject or enter both a subject code and name.",
      });
    }
  });

export const approvePaperSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    regulationId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    subjectCode: z
      .string()
      .trim()
      .min(2, "Subject code must be at least 2 characters.")
      .max(24)
      .toUpperCase()
      .optional(),
    subjectName: z
      .string()
      .trim()
      .min(2, "Subject name must be at least 2 characters.")
      .max(160)
      .optional(),
    yearOfStudy: z.coerce.number().int().min(1).max(4).optional(),
    semester: z.coerce.number().int().min(1).max(8).optional(),
    examType: examTypeSchema.optional(),
    examMonth: z.coerce.number().int().min(1).max(12).optional(),
    examYear: z.coerce.number().int().min(2005).max(2035).optional(),
    setLabel: z.string().trim().max(40).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.yearOfStudy !== undefined &&
      data.semester !== undefined &&
      !isValidYearSemesterPair(data.yearOfStudy, data.semester)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semester"],
        message: `Semester ${data.semester} does not match Year ${data.yearOfStudy}.`,
      });
    }
  });

export const rejectPaperSchema = z.object({
  reason: z.string().trim().min(5, "Enter a clear rejection reason.").max(500),
});

export const zipDownloadSchema = z.union([
  z.object({
    paperIds: z.array(z.string().uuid()).min(1).max(50),
  }),
  z.object({
    filter: paperQuerySchema.omit({ page: true, limit: true, sort: true }),
  }),
]);

export const reportPaperSchema = z.object({
  reason: z.enum([
    "Blurry or unreadable scan",
    "Wrong subject or semester",
    "Wrong exam type (Regular/Supply)",
    "Incomplete or missing pages",
    "Other",
  ]),
  details: z.string().trim().max(500).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid admin email."),
  password: z.string().min(6, "Password must be at least 6 characters.").max(128),
});

export const createBranchSchema = z.object({
  code: z.string().trim().min(2).max(16).toUpperCase(),
  name: z.string().trim().min(2).max(120),
});

export const createRegulationSchema = z.object({
  code: z.string().trim().min(2).max(16).toUpperCase(),
  startYear: z.coerce.number().int().min(2000).max(2035),
});

export const createSubjectSchema = z
  .object({
    code: z.string().trim().min(2).max(24).toUpperCase(),
    name: z.string().trim().min(2).max(160),
    branchId: z.string().uuid(),
    regulationId: z.string().uuid(),
    yearOfStudy: z.coerce.number().int().min(1).max(4),
    semester: z.coerce.number().int().min(1).max(8),
    isCommonFirstYear: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!isValidYearSemesterPair(data.yearOfStudy, data.semester)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semester"],
        message: `Semester ${data.semester} does not belong to Year ${data.yearOfStudy}.`,
      });
    }
  });

export const updateSubjectSchema = z.object({
  id: z.string().uuid("Select a valid subject."),
  code: z
    .string()
    .trim()
    .min(2, "Subject code must be at least 2 characters.")
    .max(24)
    .toUpperCase()
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, "Subject name must be at least 2 characters.")
    .max(160),
});

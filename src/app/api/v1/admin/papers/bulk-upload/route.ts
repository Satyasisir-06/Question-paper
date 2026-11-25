import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, getClientIp } from "@/lib/apiResponse";
import { requireAdminApi } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ModerationService } from "@/server/services/moderationService";
import { UploadValidationError } from "@/server/services/uploadService";
import { examTypeSchema } from "@/server/validators/schemas";
import { isValidYearSemesterPair } from "@/lib/btech";
import { MAX_PDF_BYTES, MAX_PDF_MB } from "@/server/validators/pdfValidator";

const bulkUploadMetaSchema = z
  .object({
    branchId: z.string().uuid(),
    regulationId: z.string().uuid(),
    subjectId: z.string().uuid(),
    yearOfStudy: z.coerce.number().int().min(1).max(4),
    semester: z.coerce.number().int().min(1).max(8),
    examType: examTypeSchema,
    examMonth: z.coerce.number().int().min(1).max(12),
    examYear: z.coerce.number().int().min(2005).max(2035),
    setLabel: z.string().trim().max(40).optional(),
  })
  .superRefine((d, ctx) => {
    if (!isValidYearSemesterPair(d.yearOfStudy, d.semester)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["semester"],
        message: "Semester does not match Year of Study.",
      });
    }
  });

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("INVALID_FORM", "Request must be multipart/form-data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size > MAX_PDF_BYTES) {
    return apiError("INVALID_FILE", `Attach a valid PDF up to ${MAX_PDF_MB} MB.`, 400);
  }

  const parsed = bulkUploadMetaSchema.safeParse({
    branchId: formData.get("branchId"),
    regulationId: formData.get("regulationId"),
    subjectId: formData.get("subjectId"),
    yearOfStudy: formData.get("yearOfStudy"),
    semester: formData.get("semester"),
    examType: formData.get("examType"),
    examMonth: formData.get("examMonth"),
    examYear: formData.get("examYear"),
    setLabel: formData.get("setLabel") || undefined,
  });

  if (!parsed.success) {
    return apiError(
      "INVALID_METADATA",
      parsed.error.issues[0]?.message ?? "Invalid paper metadata.",
      400
    );
  }

  try {
    const db = await getDb();
    const service = new ModerationService(db, getStorageProvider());
    const published = await service.directAdminPublish({
      adminUserId: auth.user.userId,
      ipAddress: getClientIp(request),
      fileBytes: new Uint8Array(await file.arrayBuffer()),
      originalFilename: file.name || "paper.pdf",
      mimeType: file.type,
      metadata: parsed.data,
    });

    return apiSuccess(published, { status: 201 });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return apiError(err.code, err.message, err.status);
    }
    return apiError("PUBLISH_FAILED", "Unable to publish paper directly.", 500);
  }
}

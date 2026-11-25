import { NextRequest } from "next/server";
import { apiError, apiSuccess, getClientIp } from "@/lib/apiResponse";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { UploadService, UploadValidationError } from "@/server/services/uploadService";
import { uploadMetadataSchema } from "@/server/validators/schemas";
import { uploadLimiter } from "@/server/security/rateLimiter";
import { MAX_PDF_BYTES, MAX_PDF_MB } from "@/server/validators/pdfValidator";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const quota = uploadLimiter.consume(ip);
  if (!quota.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Upload limit reached. Wait a few minutes before uploading again.",
      429,
      undefined,
      { "Retry-After": String(quota.retryAfterSeconds) }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("INVALID_FORM", "Upload must be multipart/form-data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("FILE_REQUIRED", "Select a PDF file to upload.", 400);
  }

  if (file.size > MAX_PDF_BYTES) {
    return apiError(
      "FILE_TOO_LARGE",
      `Upload failed. File exceeds the ${MAX_PDF_MB} MB limit.`,
      400
    );
  }

  const rawMeta = {
    branchId: formData.get("branchId"),
    regulationId: formData.get("regulationId"),
    yearOfStudy: formData.get("yearOfStudy"),
    semester: formData.get("semester"),
    subjectId: formData.get("subjectId") ?? "",
    customSubjectCode: formData.get("customSubjectCode") ?? "",
    customSubjectName: formData.get("customSubjectName") ?? "",
    examType: formData.get("examType"),
    examMonth: formData.get("examMonth"),
    examYear: formData.get("examYear"),
    setLabel: formData.get("setLabel") ?? "",
    uploaderName: formData.get("uploaderName") ?? "",
    uploaderEmail: formData.get("uploaderEmail") ?? "",
    honeypot: formData.get("website") ?? "",
  };

  const parsed = uploadMetadataSchema.safeParse(rawMeta);
  if (!parsed.success) {
    return apiError(
      "INVALID_METADATA",
      parsed.error.issues[0]?.message ?? "Check the submission fields.",
      400,
      parsed.error.flatten()
    );
  }

  try {
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const db = await getDb();
    const service = new UploadService(db, getStorageProvider());
    const result = await service.submitStudentPaper({
      fileBytes,
      originalFilename: file.name || "paper.pdf",
      mimeType: file.type,
      metadata: parsed.data,
    });

    return apiSuccess(result, { status: 201 });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return apiError(err.code, err.message, err.status);
    }
    return apiError(
      "UPLOAD_FAILED",
      "Unable to save question paper submission.",
      500
    );
  }
}

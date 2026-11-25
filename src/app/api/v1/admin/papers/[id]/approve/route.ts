import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, getClientIp } from "@/lib/apiResponse";
import { requireAdminApi } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ModerationService } from "@/server/services/moderationService";
import { approvePaperSchema } from "@/server/validators/schemas";
import { UploadValidationError } from "@/server/services/uploadService";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError("INVALID_ID", "Invalid submission identifier.", 400);
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = approvePaperSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_UPDATES",
      parsed.error.issues[0]?.message ?? "Invalid metadata updates.",
      400
    );
  }

  try {
    const db = await getDb();
    const service = new ModerationService(db, getStorageProvider());
    const updated = await service.approvePaper({
      paperId: id,
      adminUserId: auth.user.userId,
      ipAddress: getClientIp(request),
      updates: parsed.data,
    });
    return apiSuccess(updated);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return apiError(err.code, err.message, err.status);
    }
    return apiError("APPROVE_FAILED", "Unable to approve submission.", 500);
  }
}

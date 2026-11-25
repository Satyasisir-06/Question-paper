import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, getClientIp } from "@/lib/apiResponse";
import { requireAdminApi } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ModerationService } from "@/server/services/moderationService";

const updateReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError("INVALID_ID", "Invalid report identifier.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = updateReportSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_STATUS", "Invalid report status.", 400);
  }

  const db = await getDb();
  const service = new ModerationService(db, getStorageProvider());
  const updated = await service.resolveReport(
    id,
    parsed.data.status,
    auth.user.userId,
    getClientIp(request)
  );
  if (!updated) {
    return apiError("NOT_FOUND", "Report not found.", 404);
  }
  return apiSuccess(updated);
}

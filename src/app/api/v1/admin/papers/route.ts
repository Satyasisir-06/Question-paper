import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { sanitizeConnectionError } from "@/lib/env";
import { requireAdminApi } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ModerationService } from "@/server/services/moderationService";
import { paperStatusSchema } from "@/server/validators/schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  const statusParam = request.nextUrl.searchParams.get("status") ?? "PENDING";
  const parsed = paperStatusSchema.safeParse(statusParam);
  if (!parsed.success) {
    return apiError("INVALID_STATUS", "Invalid moderation status filter.", 400);
  }

  try {
    const db = await getDb();
    const service = new ModerationService(db, getStorageProvider());
    const items = await service.listAdminPapers(parsed.data);
    return apiSuccess(items);
  } catch (err) {
    return apiError("ADMIN_LIST_FAILED", sanitizeConnectionError(err), 500);
  }
}

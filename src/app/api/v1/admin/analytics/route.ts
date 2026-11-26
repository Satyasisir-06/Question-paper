import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { sanitizeConnectionError } from "@/lib/env";
import { requireAdminApi } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ModerationService } from "@/server/services/moderationService";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  try {
    const db = await getDb();
    const service = new ModerationService(db, getStorageProvider());
    const [analytics, auditLogs] = await Promise.all([
      service.getAnalytics(),
      service.listAuditLogs(40),
    ]);

    return apiSuccess({ ...analytics, auditLogs });
  } catch (err) {
    return apiError("ANALYTICS_FAILED", sanitizeConnectionError(err), 500);
  }
}

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { UploadService } from "@/server/services/uploadService";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const normalized = code.trim().toUpperCase();
  if (!/^PV-[A-Z0-9]{4,12}$/.test(normalized)) {
    return apiError(
      "INVALID_TRACKING_CODE",
      "Tracking code must look like PV-8F2A1C.",
      400
    );
  }

  const db = await getDb();
  const service = new UploadService(db, getStorageProvider());
  const tracked = await service.trackByCode(normalized);
  if (!tracked) {
    return apiError(
      "NOT_FOUND",
      "No submission matches that tracking code.",
      404
    );
  }

  return apiSuccess(tracked);
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/apiResponse";
import { sanitizeConnectionError } from "@/lib/env";
import { nodeStreamToWebStream } from "@/lib/streamAdapter";
import { requireAdminApi } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ModerationService } from "@/server/services/moderationService";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError("INVALID_ID", "Invalid submission identifier.", 400);
  }

  try {
    const db = await getDb();
    const service = new ModerationService(db, getStorageProvider());
    const preview = await service.openAdminPreviewStream(id);
    if (!preview) {
      return apiError("NOT_FOUND", "Submission PDF not found.", 404);
    }

    return new Response(nodeStreamToWebStream(preview.stream), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Content-Length": String(preview.sizeBytes),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return apiError("PREVIEW_FAILED", sanitizeConnectionError(err), 500);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { sanitizeConnectionError } from "@/lib/env";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError("INVALID_ID", "Invalid question paper identifier.", 400);
  }

  try {
    const db = await getDb();
    const service = new PaperService(db, getStorageProvider());
    const paper = await service.getApprovedPaper(id);
    if (!paper) {
      return apiError("NOT_FOUND", "Question paper not found.", 404);
    }
    return apiSuccess(paper);
  } catch (err) {
    return apiError("PAPER_FETCH_FAILED", sanitizeConnectionError(err), 500);
  }
}

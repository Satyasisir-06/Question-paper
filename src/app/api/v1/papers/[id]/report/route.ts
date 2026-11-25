import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, getClientIp } from "@/lib/apiResponse";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";
import { reportPaperSchema } from "@/server/validators/schemas";
import { reportLimiter } from "@/server/security/rateLimiter";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return apiError("INVALID_ID", "Invalid question paper identifier.", 400);
  }

  const ip = getClientIp(request);
  const quota = reportLimiter.consume(ip);
  if (!quota.allowed) {
    return apiError("RATE_LIMITED", "Too many reports submitted.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = reportPaperSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_REPORT",
      parsed.error.issues[0]?.message ?? "Select a valid issue reason.",
      400
    );
  }

  const db = await getDb();
  const service = new PaperService(db, getStorageProvider());
  const report = await service.reportPaper({
    paperId: id,
    reason: parsed.data.reason,
    details: parsed.data.details,
    ipAddress: ip,
  });

  if (!report) {
    return apiError("NOT_FOUND", "Question paper not found.", 404);
  }

  return apiSuccess({ id: report.id, status: report.status }, { status: 201 });
}

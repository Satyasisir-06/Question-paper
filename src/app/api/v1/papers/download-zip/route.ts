import { NextRequest } from "next/server";
import { apiError, getClientIp } from "@/lib/apiResponse";
import { nodeStreamToWebStream } from "@/lib/streamAdapter";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ZipLimitError, ZipStreamService } from "@/server/services/zipStreamService";
import { zipDownloadSchema } from "@/server/validators/schemas";
import { zipLimiter } from "@/server/security/rateLimiter";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const quota = zipLimiter.consume(ip);
  if (!quota.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many folder archive requests. Wait a few minutes and try again.",
      429,
      undefined,
      { "Retry-After": String(quota.retryAfterSeconds) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = zipDownloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_ZIP_REQUEST",
      parsed.error.issues[0]?.message ?? "Invalid folder download selection.",
      400
    );
  }

  try {
    const db = await getDb();
    const service = new ZipStreamService(db, getStorageProvider());
    const archive = await service.createZipArchiveStream(parsed.data);

    return new Response(nodeStreamToWebStream(archive.stream), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archive.filename}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Archive-Count": String(archive.includedCount),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ZipLimitError) {
      return apiError(err.code, err.message, err.status);
    }
    return apiError("ZIP_FAILED", "Unable to package PDF folder archive.", 500);
  }
}

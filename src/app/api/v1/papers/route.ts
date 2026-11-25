import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";
import { paperQuerySchema } from "@/server/validators/schemas";

export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = paperQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      "INVALID_QUERY",
      parsed.error.issues[0]?.message ?? "Invalid search parameters.",
      400,
      parsed.error.flatten()
    );
  }

  try {
    const db = await getDb();
    const service = new PaperService(db, getStorageProvider());
    const { items, meta } = await service.searchPublicPapers(parsed.data);
    return apiSuccess(items, { meta });
  } catch {
    return apiError("SEARCH_FAILED", "Unable to load question papers.", 500);
  }
}

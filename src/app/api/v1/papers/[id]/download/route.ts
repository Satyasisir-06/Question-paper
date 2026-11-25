import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/apiResponse";
import { nodeStreamToWebStream } from "@/lib/streamAdapter";
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

  const db = await getDb();
  const service = new PaperService(db, getStorageProvider());
  const pdf = await service.openApprovedPdfStream(id, "download");
  if (!pdf) {
    return apiError("NOT_FOUND", "Question paper not found.", 404);
  }

  return new Response(nodeStreamToWebStream(pdf.stream), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Content-Length": String(pdf.sizeBytes),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

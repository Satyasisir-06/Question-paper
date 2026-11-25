import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { requireAdminApi } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { CatalogService } from "@/server/services/catalogService";
import {
  createBranchSchema,
  createRegulationSchema,
  createSubjectSchema,
} from "@/server/validators/schemas";

const catalogActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("branch"), data: createBranchSchema }),
  z.object({ kind: z.literal("regulation"), data: createRegulationSchema }),
  z.object({ kind: z.literal("subject"), data: createSubjectSchema }),
  z.object({
    kind: z.literal("csv_subjects"),
    data: z.object({ csv: z.string().min(5).max(500_000) }),
  }),
]);

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  const db = await getDb();
  const service = new CatalogService(db);
  return apiSuccess(await service.getCatalog());
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.authorized) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = catalogActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_CATALOG_INPUT",
      parsed.error.issues[0]?.message ?? "Check catalog form fields.",
      400
    );
  }

  try {
    const db = await getDb();
    const service = new CatalogService(db);
    switch (parsed.data.kind) {
      case "branch": {
        const created = await service.createBranch(
          parsed.data.data.code,
          parsed.data.data.name
        );
        return apiSuccess(created, { status: 201 });
      }
      case "regulation": {
        const created = await service.createRegulation(
          parsed.data.data.code,
          parsed.data.data.startYear
        );
        return apiSuccess(created, { status: 201 });
      }
      case "subject": {
        const created = await service.createSubject(parsed.data.data);
        return apiSuccess(created, { status: 201 });
      }
      case "csv_subjects": {
        const summary = await service.importSubjectsFromCsv(parsed.data.data.csv);
        return apiSuccess(summary, { status: 201 });
      }
    }
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("unique")
        ? "A matching branch, regulation, or subject already exists."
        : "Unable to save catalog entry.";
    return apiError("CATALOG_SAVE_FAILED", message, 409);
  }
}

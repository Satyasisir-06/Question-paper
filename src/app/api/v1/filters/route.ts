import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const service = new PaperService(db, getStorageProvider());
    const catalog = await service.getFilters();

    const yearParam = request.nextUrl.searchParams.get("year");
    const semParam = request.nextUrl.searchParams.get("sem");
    const branchIdParam = request.nextUrl.searchParams.get("branchId");

    const filteredSubjects = catalog.subjects.filter((s) => {
      if (yearParam && s.yearOfStudy !== Number(yearParam)) return false;
      if (semParam && s.semester !== Number(semParam)) return false;
      if (branchIdParam && s.branchId !== branchIdParam && !s.isCommonFirstYear) {
        return false;
      }
      return true;
    });

    return apiSuccess({
      ...catalog,
      subjects: filteredSubjects,
    });
  } catch {
    return apiError("CATALOG_ERROR", "Unable to load filter catalog.", 500);
  }
}

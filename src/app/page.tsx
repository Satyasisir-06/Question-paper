import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { PaperService } from "@/server/services/paperService";
import { ExplorerClient } from "@/components/explorer/ExplorerClient";
import { HomePageSkeleton } from "@/components/ui/Skeletons";
import { sanitizeConnectionError } from "@/lib/env";
import type { FilterCatalogDto, PaperDto } from "@/types/paper";

const EMPTY_CATALOG: FilterCatalogDto = {
  branches: [],
  regulations: [],
  subjects: [],
  examYears: [],
};

async function ExplorerLoader() {
  await connection();

  let catalog: FilterCatalogDto = EMPTY_CATALOG;
  let serializedPapers: PaperDto[] = [];
  let total = 0;
  let initialError = "";

  try {
    const db = await getDb();
    const service = new PaperService(db);
    const [filtersData, searchRes] = await Promise.all([
      service.getFilters(),
      service.searchPublicPapers({ sort: "newest", page: 1, limit: 40 }),
    ]);

    catalog = filtersData;
    serializedPapers = searchRes.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    }));
    total = searchRes.meta.total;
  } catch (err) {
    console.error("[explorer] failed to load archive:", err);
    initialError = `Unable to connect to archive database (${sanitizeConnectionError(err)}). Check Vercel Environment Variables or /api/v1/health.`;
  }

  return (
    <ExplorerClient
      initialCatalog={catalog}
      initialPapers={serializedPapers}
      initialTotal={total}
      initialError={initialError}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <ExplorerLoader />
    </Suspense>
  );
}

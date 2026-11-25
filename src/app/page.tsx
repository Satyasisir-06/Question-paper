import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { PaperService } from "@/server/services/paperService";
import { ExplorerClient } from "@/components/explorer/ExplorerClient";
import type { FilterCatalogDto, PaperDto } from "@/types/paper";

const EMPTY_CATALOG: FilterCatalogDto = {
  branches: [],
  regulations: [],
  subjects: [],
  examYears: [],
};

function sanitizeLoadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Database connection failed.";
  return msg.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]");
}

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
    initialError = `Unable to connect to archive database (${sanitizeLoadError(err)}). Check Vercel Environment Variables or /api/v1/health.`;
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

function ExplorerShellFallback() {
  return (
    <div className="min-h-screen max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="h-16 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]" />
      <div className="h-24 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="hidden lg:block h-96 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]" />
        <div className="lg:col-span-3 space-y-3">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-24 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<ExplorerShellFallback />}>
      <ExplorerLoader />
    </Suspense>
  );
}

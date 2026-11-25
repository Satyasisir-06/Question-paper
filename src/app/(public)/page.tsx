import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";
import { ExplorerClient } from "@/components/explorer/ExplorerClient";

async function ExplorerLoader() {
  await connection();
  const db = await getDb();
  const service = new PaperService(db, getStorageProvider());
  const [catalog, searchRes] = await Promise.all([
    service.getFilters(),
    service.searchPublicPapers({ sort: "newest", page: 1, limit: 40 }),
  ]);

  const serializedPapers = searchRes.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <ExplorerClient
      initialCatalog={catalog}
      initialPapers={serializedPapers}
      initialTotal={searchRes.meta.total}
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

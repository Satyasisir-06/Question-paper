import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";
import { ModerationService } from "@/server/services/moderationService";
import { AdminNav } from "@/components/admin/AdminNav";
import { CatalogManagerClient } from "@/components/admin/CatalogManagerClient";

async function AdminCatalogBody() {
  await connection();
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }

  const db = await getDb();
  const storage = getStorageProvider();
  const [catalog, auditLogs] = await Promise.all([
    new PaperService(db, storage).getFilters(),
    new ModerationService(db, storage).listAuditLogs(40),
  ]);

  const serializedLogs = auditLogs.map((l) => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    ipAddress: l.ipAddress,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <>
      <AdminNav adminName={user.name} />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6">
        <CatalogManagerClient
          initialCatalog={catalog}
          initialAuditLogs={serializedLogs}
        />
      </main>
    </>
  );
}

export default function AdminCatalogPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense
        fallback={
          <div className="max-w-7xl w-full mx-auto px-6 py-8">
            <div className="h-96 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]" />
          </div>
        }
      >
        <AdminCatalogBody />
      </Suspense>
    </div>
  );
}

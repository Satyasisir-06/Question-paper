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
import { ServerErrorBanner } from "@/components/ui/ServerErrorBanner";
import { AdminSectionSkeleton } from "@/components/ui/Skeletons";
import { sanitizeConnectionError } from "@/lib/env";

async function AdminCatalogBody() {
  await connection();
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }

  let catalog: Awaited<ReturnType<PaperService["getFilters"]>> | null = null;
  let serializedLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    ipAddress: string | null;
    createdAt: string;
  }> = [];
  let dbError = "";
  try {
    const db = await getDb();
    const storage = getStorageProvider();
    const [filters, auditLogs] = await Promise.all([
      new PaperService(db, storage).getFilters(),
      new ModerationService(db, storage).listAuditLogs(40),
    ]);
    catalog = filters;
    serializedLogs = auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error("[admin] catalog load error:", err);
    dbError = `Unable to load admin catalog (${sanitizeConnectionError(err)}). Check Vercel Environment Variables or /api/v1/health.`;
  }

  return (
    <>
      <AdminNav adminName={user.name} />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-4 md:px-6 pt-5 pb-28 md:py-6">
        {dbError || !catalog ? (
          <ServerErrorBanner message={dbError || "Unable to load admin catalog."} />
        ) : (
          <CatalogManagerClient
            initialCatalog={catalog}
            initialAuditLogs={serializedLogs}
          />
        )}
      </main>
    </>
  );
}

export default function AdminCatalogPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<AdminSectionSkeleton variant="catalog" />}>
        <AdminCatalogBody />
      </Suspense>
    </div>
  );
}

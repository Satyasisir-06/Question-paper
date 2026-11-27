import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { ModerationService } from "@/server/services/moderationService";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminOverviewClient } from "@/components/admin/AdminOverviewClient";
import { ServerErrorBanner } from "@/components/ui/ServerErrorBanner";
import { AdminSectionSkeleton } from "@/components/ui/Skeletons";
import { sanitizeConnectionError } from "@/lib/env";

async function AdminOverviewBody() {
  await connection();
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }

  let analytics: Awaited<ReturnType<ModerationService["getAnalytics"]>> | null = null;
  let dbError = "";
  try {
    const db = await getDb();
    const service = new ModerationService(db, getStorageProvider());
    analytics = await service.getAnalytics();
  } catch (err) {
    console.error("[admin] overview load error:", err);
    dbError = `Unable to load admin analytics (${sanitizeConnectionError(err)}). Check Vercel Environment Variables or /api/v1/health.`;
  }

  return (
    <>
      <AdminNav adminName={user.name} />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-4 md:px-6 pt-5 pb-28 md:py-6">
        {dbError || !analytics ? (
          <ServerErrorBanner message={dbError || "Unable to load admin analytics."} />
        ) : (
          <AdminOverviewClient initialData={analytics} />
        )}
      </main>
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<AdminSectionSkeleton variant="overview" />}>
        <AdminOverviewBody />
      </Suspense>
    </div>
  );
}

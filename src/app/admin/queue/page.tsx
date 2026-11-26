import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";
import { ModerationService } from "@/server/services/moderationService";
import { AdminNav } from "@/components/admin/AdminNav";
import { ServerErrorBanner } from "@/components/ui/ServerErrorBanner";
import {
  ModerationWorkbenchClient,
  type AdminQueueItemDto,
} from "@/components/admin/ModerationWorkbenchClient";
import { sanitizeConnectionError } from "@/lib/env";

async function AdminQueueBody() {
  await connection();
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }

  let catalog: Awaited<ReturnType<PaperService["getFilters"]>> | null = null;
  let initialItems: AdminQueueItemDto[] = [];
  let dbError = "";
  try {
    const db = await getDb();
    const storage = getStorageProvider();
    const [filters, pendingList] = await Promise.all([
      new PaperService(db, storage).getFilters(),
      new ModerationService(db, storage).listAdminPapers("PENDING"),
    ]);
    catalog = filters;
    initialItems = pendingList.map((item) => ({
      id: item.id,
      trackingCode: item.trackingCode,
      subjectId: item.subjectId,
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
      branchId: item.branchId,
      branchCode: item.branchCode,
      regulationId: item.regulationId,
      regulationCode: item.regulationCode,
      yearOfStudy: item.yearOfStudy,
      semester: item.semester,
      examType: item.examType,
      examMonth: item.examMonth,
      examYear: item.examYear,
      setLabel: item.setLabel,
      fileSizeBytes: item.fileSizeBytes,
      pageCount: item.pageCount,
      status: item.status,
      uploaderName: item.uploaderName,
      uploaderEmail: item.uploaderEmail,
      rejectionReason: item.rejectionReason,
      duplicateMatches: item.duplicateMatches,
    }));
  } catch (err) {
    console.error("[admin] queue load error:", err);
    dbError = `Unable to load moderation queue (${sanitizeConnectionError(err)}). Check Vercel Environment Variables or /api/v1/health.`;
  }

  return (
    <>
      <AdminNav adminName={user.name} />
      <main id="main-content" className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {dbError || !catalog ? (
          <ServerErrorBanner message={dbError || "Unable to load moderation queue."} />
        ) : (
          <ModerationWorkbenchClient
            catalog={catalog}
            initialItems={initialItems}
          />
        )}
      </main>
    </>
  );
}

export default function AdminQueuePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense
        fallback={
          <div className="max-w-7xl w-full mx-auto px-6 py-8">
            <div className="h-96 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]" />
          </div>
        }
      >
        <AdminQueueBody />
      </Suspense>
    </div>
  );
}

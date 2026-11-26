import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { PaperService } from "@/server/services/paperService";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ServerErrorBanner } from "@/components/ui/ServerErrorBanner";
import { UploadPageSkeleton } from "@/components/ui/Skeletons";
import { UploadFormClient } from "@/components/upload/UploadFormClient";
import { sanitizeConnectionError } from "@/lib/env";
import type { ExamTypeValue } from "@/lib/btech";
import type { FilterCatalogDto } from "@/types/paper";

export const metadata: Metadata = {
  title: "Upload Question Paper",
  description:
    "Submit a B.Tech question paper PDF or photo for exam admin verification before public release.",
};

const EMPTY_CATALOG: FilterCatalogDto = {
  branches: [],
  regulations: [],
  subjects: [],
  examYears: [],
};

async function UploadPageBody({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParamsPromise;

  let catalog: FilterCatalogDto = EMPTY_CATALOG;
  let dbError = "";
  try {
    const db = await getDb();
    const service = new PaperService(db);
    catalog = await service.getFilters();
  } catch (err) {
    console.error("[upload] catalog load error:", err);
    dbError = `Database is currently unreachable (${sanitizeConnectionError(err)}). Check Vercel Environment Variables or /api/v1/health.`;
  }

  const yearNum = Number(sp.year);
  const semNum = Number(sp.sem);
  const examRaw = typeof sp.examType === "string" ? sp.examType : undefined;
  const examType =
    examRaw === "REGULAR" || examRaw === "SUPPLY" ? (examRaw as ExamTypeValue) : undefined;

  if (dbError) {
    return <ServerErrorBanner message={dbError} />;
  }

  return (
    <UploadFormClient
      catalog={catalog}
      defaultYear={Number.isInteger(yearNum) && yearNum >= 1 && yearNum <= 4 ? yearNum : undefined}
      defaultSem={Number.isInteger(semNum) && semNum >= 1 && semNum <= 8 ? semNum : undefined}
      defaultExamType={examType}
    />
  );
}

export default function UploadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main
        id="main-content"
        className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-6 py-8 space-y-6"
      >
        <div className="max-w-[680px] mx-auto space-y-1">
          <h1 className="heading-4 text-[var(--text-primary)]">
            Upload a question paper
          </h1>
          <p className="body-6 text-[var(--text-secondary)]">
            Share missing Regular or Supply papers with fellow students. Every
            upload enters admin review before going public.
          </p>
        </div>

        <Suspense fallback={<UploadPageSkeleton />}>
          <UploadPageBody searchParamsPromise={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

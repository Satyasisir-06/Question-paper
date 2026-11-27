import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { ArrowLeft, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/server/db/client";
import { PaperService } from "@/server/services/paperService";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ExamTypeBadge } from "@/components/ui/ExamBadge";
import { ServerErrorBanner } from "@/components/ui/ServerErrorBanner";
import { PaperDetailSkeleton } from "@/components/ui/Skeletons";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { sanitizeConnectionError } from "@/lib/env";
import {
  EXAM_TYPE_META,
  formatExamMonth,
  formatFileSize,
  formatYearSemCode,
} from "@/lib/btech";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return { title: "Question paper not found" };
  }

  try {
    const db = await getDb();
    const service = new PaperService(db);
    const paper = await service.getApprovedPaper(id);
    if (!paper) {
      return { title: "Question paper not found" };
    }

    const yearSem = formatYearSemCode(paper.yearOfStudy, paper.semester);
    const examLabel = EXAM_TYPE_META[paper.examType].label;
    const session = `${formatExamMonth(paper.examMonth)} ${paper.examYear}`;

    return {
      title: `${paper.subjectCode} ${paper.subjectName} (${examLabel} ${session})`,
      description: `Preview and download B.Tech ${paper.branchCode} ${yearSem} ${paper.subjectCode} ${paper.subjectName} ${examLabel} question paper (${session}, ${paper.regulationCode}).`,
    };
  } catch {
    return { title: "Question paper preview" };
  }
}

async function PaperDetailContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await paramsPromise;
  if (!z.string().uuid().safeParse(id).success) {
    notFound();
  }

  let paper: Awaited<ReturnType<PaperService["getApprovedPaper"]>> = null;
  let dbError = "";
  try {
    const db = await getDb();
    const service = new PaperService(db);
    paper = await service.getApprovedPaper(id);
  } catch (err) {
    console.error("[paper-detail] load error:", err);
    dbError = `Unable to connect to archive database (${sanitizeConnectionError(err)}). Check Vercel Environment Variables or /api/v1/health.`;
  }

  if (dbError) {
    return (
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 md:px-6 py-8">
        <ServerErrorBanner message={dbError} />
      </main>
    );
  }

  if (!paper) {
    notFound();
  }

  const yearSem = formatYearSemCode(paper.yearOfStudy, paper.semester);
  const session = `${formatExamMonth(paper.examMonth)} ${paper.examYear}`;

  return (
    <main
      id="main-content"
      className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-4 md:px-6 pt-4 sm:pt-6 pb-28 md:pb-8 flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 caption-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft size={14} weight="regular" />
            <span>Back to question paper archive</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono caption-4 px-2 py-0.5 rounded-md bg-[var(--surface-raised)] text-[var(--text-primary)]">
              {paper.subjectCode}
            </span>
            <span className="font-mono caption-4 text-[var(--text-secondary)]">
              {yearSem} · {paper.branchCode} · {paper.regulationCode}
            </span>
            <ExamTypeBadge examType={paper.examType} />
          </div>

          <h1 className="heading-4 sm:heading-6 text-[var(--text-primary)]">
            {paper.subjectName} ({session})
          </h1>
        </div>

        <a
          href={`/api/v1/papers/${paper.id}/download`}
          className="inline-flex items-center justify-center gap-2 h-12 sm:h-10 px-5 rounded-xl sm:rounded-lg button-sm text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] active:scale-[0.98] transition-[background-color,transform] duration-200"
        >
          <DownloadSimple size={16} weight="regular" />
          <span>Download PDF ({formatFileSize(paper.fileSizeBytes)})</span>
        </a>
      </div>

      <div className="bezel-shell">
        <div className="bezel-core h-[72dvh] min-h-[480px] p-2 sm:p-3 overflow-hidden">
          <PdfViewer
            src={`/api/v1/papers/${paper.id}/view`}
            title={`${paper.subjectCode} ${paper.subjectName}`}
          />
        </div>
      </div>
    </main>
  );
}

export default function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <Suspense fallback={<PaperDetailSkeleton />}>
        <PaperDetailContent paramsPromise={params} />
      </Suspense>
    </div>
  );
}

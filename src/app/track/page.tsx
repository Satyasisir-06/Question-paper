import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { UploadService } from "@/server/services/uploadService";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  TrackClient,
  type TrackedSubmission,
} from "@/components/upload/TrackClient";

export const metadata: Metadata = {
  title: "Track Upload Status",
  description:
    "Check whether your uploaded question paper is pending, approved, or needs re-upload.",
};

async function TrackBody({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParamsPromise;
  const initialCode =
    typeof sp.code === "string" ? sp.code.trim().toUpperCase() : undefined;

  let initialResult: TrackedSubmission | null = null;
  let initialError = "";

  if (initialCode) {
    try {
      const db = await getDb();
      const service = new UploadService(db);
      const found = await service.trackByCode(initialCode);
      if (!found) {
        initialError = "No submission matches that tracking code.";
      } else {
        initialResult = {
          ...found,
          createdAt: found.createdAt.toISOString(),
          reviewedAt: found.reviewedAt ? found.reviewedAt.toISOString() : null,
        };
      }
    } catch (err) {
      console.error("[track] lookup error:", err);
      initialError = "Database is currently unavailable. Try again shortly.";
    }
  }

  return (
    <TrackClient
      initialCode={initialCode}
      initialResult={initialResult}
      initialError={initialError}
    />
  );
}

export default function TrackPage({
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
        <div className="max-w-xl mx-auto space-y-1">
          <h1 className="heading-4 text-[var(--text-primary)]">
            Track submission status
          </h1>
          <p className="body-6 text-[var(--text-secondary)]">
            Enter your submission code (for example PV-PEND01) to check admin
            approval status.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="max-w-xl mx-auto h-24 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)]" />
          }
        >
          <TrackBody searchParamsPromise={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

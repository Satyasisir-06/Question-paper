"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { StatusBadge, ExamTypeBadge } from "@/components/ui/ExamBadge";
import { safeReadApiJson } from "@/lib/httpClient";
import {
  formatExamMonth,
  formatYearSemCode,
  type ExamTypeValue,
  type PaperStatusValue,
} from "@/lib/btech";

export interface TrackedSubmission {
  paperId: string | null;
  trackingCode: string;
  status: PaperStatusValue;
  subjectCode: string;
  subjectName: string;
  branchCode: string;
  regulationCode: string;
  yearOfStudy: number;
  semester: number;
  examType: ExamTypeValue;
  examMonth: number;
  examYear: number;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export function TrackClient({
  initialCode,
  initialResult,
  initialError,
}: {
  initialCode?: string;
  initialResult?: TrackedSubmission | null;
  initialError?: string;
}) {
  const [code, setCode] = useState(initialCode ?? "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError ?? "");
  const [result, setResult] = useState<TrackedSubmission | null>(
    initialResult ?? null
  );

  const lookup = async (targetCode: string) => {
    const clean = targetCode.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setErrorMsg("");
    setResult(null);
    try {
      const res = await fetch(
        `/api/v1/uploads/track/${encodeURIComponent(clean)}`
      );
      const parsed = await safeReadApiJson<TrackedSubmission>(
        res,
        "Submission not found."
      );
      if (!parsed.ok || !parsed.data) {
        setErrorMsg(parsed.errorMessage);
        return;
      }
      setResult(parsed.data);
    } catch {
      setErrorMsg("Unable to reach tracking endpoint.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
        className="rounded-2xl p-4 flex flex-col sm:flex-row gap-2"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter tracking code (e.g. PV-8F2A1C)"
          aria-label="Submission tracking code"
          className="flex-1 h-11 sm:h-10 px-3 rounded-lg font-mono text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          style={{ border: "1px solid var(--border-primary)" }}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
        >
          <MagnifyingGlass size={16} weight="regular" />
          <span>{loading ? "Checking" : "Check status"}</span>
        </button>
      </form>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl p-4 body-6"
          style={{
            backgroundColor: "var(--badge-rejected-bg)",
            color: "var(--badge-rejected-text)",
            border: "1px solid var(--badge-rejected-border)",
          }}
        >
          {errorMsg}
        </div>
      )}

      {result && (
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono caption-4 text-[var(--text-muted)]">
              {result.trackingCode}
            </span>
            <StatusBadge status={result.status} />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono caption-4 px-2 py-0.5 rounded bg-[var(--surface-raised)]">
                {result.subjectCode}
              </span>
              <span className="font-mono caption-4 text-[var(--text-secondary)]">
                {formatYearSemCode(result.yearOfStudy, result.semester)} ·{" "}
                {result.branchCode} · {result.regulationCode}
              </span>
              <ExamTypeBadge examType={result.examType} />
            </div>
            <h2 className="title-3 text-[var(--text-primary)]">
              {result.subjectName} ({formatExamMonth(result.examMonth)}{" "}
              {result.examYear})
            </h2>
          </div>

          {result.status === "PENDING" && (
            <p className="body-6 text-[var(--text-secondary)]">
              An exam admin has not reviewed this submission yet. It remains
              private until approved.
            </p>
          )}

          {result.status === "REJECTED" && (
            <div
              className="rounded-lg p-3 space-y-1"
              style={{
                backgroundColor: "var(--badge-rejected-bg)",
                border: "1px solid var(--badge-rejected-border)",
              }}
            >
              <p
                className="caption-4"
                style={{ color: "var(--badge-rejected-text)" }}
              >
                Rejection reason
              </p>
              <p className="body-6 text-[var(--text-primary)]">
                {result.rejectionReason ?? "Did not meet archive quality requirements."}
              </p>
            </div>
          )}

          {result.status === "APPROVED" && result.paperId && (
            <div className="pt-1">
              <Link
                href={`/papers/${result.paperId}`}
                className="inline-flex items-center h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                View published question paper
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

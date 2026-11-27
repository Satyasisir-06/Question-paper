"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  CircleNotch,
  Clock,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
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
      <div className="bezel-shell">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
          className="bezel-core p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--action-primary)]"
        >
          <div className="relative flex-1 flex items-center min-w-0">
            <MagnifyingGlass
              size={18}
              weight="regular"
              className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none shrink-0"
            />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Code (e.g. PV-A1B2C3)"
              aria-label="Submission tracking code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="w-full h-11 sm:h-10 pl-10 pr-9 rounded-xl font-mono text-base sm:text-sm tracking-wide bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            {code.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  setErrorMsg("");
                  setResult(null);
                }}
                aria-label="Clear tracking code"
                className="absolute right-2 w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] cursor-pointer"
              >
                <X size={14} weight="regular" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="tap-press inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-xl button-sm text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] disabled:opacity-60 cursor-pointer shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
          >
            {loading ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={16} weight="regular" />
            )}
            <span>{loading ? "Checking..." : "Check status"}</span>
          </button>
        </form>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl p-4 body-6"
          style={{
            backgroundColor: "var(--badge-rejected-bg)",
            color: "var(--badge-rejected-text)",
            border: "1px solid var(--badge-rejected-border)",
          }}
        >
          {errorMsg}
        </div>
      )}

      {!result && !errorMsg && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="rounded-2xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--text-primary)] title-4">
              <Clock size={16} weight="regular" className="text-[var(--badge-pending-text)]" />
              <span>Pending review</span>
            </div>
            <p className="caption-5 text-[var(--text-secondary)]">
              Uploads remain private until an exam admin verifies the PDF pages.
            </p>
          </div>
          <div className="rounded-2xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--text-primary)] title-4">
              <CheckCircle size={16} weight="regular" className="text-[var(--badge-regular-text)]" />
              <span>Published</span>
            </div>
            <p className="caption-5 text-[var(--text-secondary)]">
              Once approved, the paper goes live with a shareable archive link.
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="reveal-up bezel-shell">
          <div className="bezel-core p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono caption-4 text-[var(--text-muted)]">
                {result.trackingCode}
              </span>
              <StatusBadge status={result.status} />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono caption-4 px-2 py-0.5 rounded-md bg-[var(--surface-raised)]">
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

            <ol
              aria-label="Submission verification timeline"
              className="pt-2 border-t border-[var(--border-primary)] grid grid-cols-3 gap-2 font-mono text-[11px]"
            >
              <li className="rounded-lg p-2 bg-[var(--surface-raised)]">
                <span className="block text-[var(--badge-regular-text)]">1. Received</span>
                <span className="block text-[var(--text-muted)] truncate">Queued PDF</span>
              </li>
              <li className="rounded-lg p-2 bg-[var(--surface-raised)]">
                <span
                  className="block"
                  style={{
                    color:
                      result.status === "PENDING"
                        ? "var(--badge-pending-text)"
                        : "var(--badge-regular-text)",
                  }}
                >
                  2. Review
                </span>
                <span className="block text-[var(--text-muted)] truncate">
                  {result.status === "PENDING" ? "In exam cell" : "Verified"}
                </span>
              </li>
              <li className="rounded-lg p-2 bg-[var(--surface-raised)]">
                <span
                  className="block"
                  style={{
                    color:
                      result.status === "APPROVED"
                        ? "var(--badge-regular-text)"
                        : result.status === "REJECTED"
                          ? "var(--badge-rejected-text)"
                          : "var(--text-muted)",
                  }}
                >
                  3. Outcome
                </span>
                <span className="block text-[var(--text-muted)] truncate">
                  {result.status === "APPROVED"
                    ? "Live in archive"
                    : result.status === "REJECTED"
                      ? "Needs re-upload"
                      : "Awaiting decision"}
                </span>
              </li>
            </ol>

            {result.status === "PENDING" && (
              <p className="body-6 text-[var(--text-secondary)]">
                An exam admin has not reviewed this submission yet. It remains
                private until approved.
              </p>
            )}

            {result.status === "REJECTED" && (
              <div
                className="rounded-xl p-3.5 space-y-1"
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
                  className="inline-flex items-center justify-center h-11 sm:h-10 px-5 rounded-xl sm:rounded-lg button-sm text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)]"
                >
                  View published question paper
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

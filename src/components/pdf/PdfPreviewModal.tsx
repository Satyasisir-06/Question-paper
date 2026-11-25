"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  Check,
  DownloadSimple,
  Flag,
  LinkSimple,
  X,
} from "@phosphor-icons/react";
import type { PaperDto } from "@/types/paper";
import {
  formatExamMonth,
  formatFileSize,
  formatYearSemCode,
} from "@/lib/btech";
import { ExamTypeBadge } from "@/components/ui/ExamBadge";
import { PdfViewer } from "@/components/pdf/PdfViewer";

interface PdfPreviewModalProps {
  paper: PaperDto | null;
  onClose: () => void;
}

const REPORT_REASONS = [
  "Blurry or unreadable scan",
  "Wrong subject or semester",
  "Wrong exam type (Regular/Supply)",
  "Incomplete or missing pages",
  "Other",
] as const;

function PdfPreviewDialogBody({
  paper,
  onClose,
}: {
  paper: PaperDto;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportStatus, setReportStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const yearSem = formatYearSemCode(paper.yearOfStudy, paper.semester);
  const session = `${formatExamMonth(paper.examMonth)} ${paper.examYear}`;

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/papers/${paper.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportStatus("submitting");
    setReportMessage("");
    try {
      const res = await fetch(`/api/v1/papers/${paper.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setReportStatus("error");
        setReportMessage(json.error?.message ?? "Unable to submit report.");
        return;
      }
      setReportStatus("done");
      setReportMessage("Report submitted for admin review.");
      setReportDetails("");
    } catch {
      setReportStatus("error");
      setReportMessage("Network error while submitting report.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-5xl h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-mono caption-4 px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-primary)]">
                  {paper.subjectCode}
                </span>
                <span className="font-mono caption-4 text-[var(--text-muted)]">
                  {yearSem} · {paper.branchCode} · {paper.regulationCode}
                </span>
                <ExamTypeBadge examType={paper.examType} />
              </div>
              <h2
                id="pdf-modal-title"
                className="title-3 text-[var(--text-primary)] mt-1 truncate"
              >
                {paper.subjectName} ({session})
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="sm:hidden inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-lg text-[var(--text-secondary)] bg-[var(--surface-raised)]"
            >
              <X size={18} weight="regular" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 h-10 sm:h-9 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 active:scale-[0.98] transition-[opacity,transform] duration-200 cursor-pointer"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {copied ? (
                <Check size={16} weight="regular" />
              ) : (
                <LinkSimple size={16} weight="regular" />
              )}
              <span>{copied ? "Copied" : "Share"}</span>
            </button>

            <button
              type="button"
              onClick={() => setReportOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 h-10 sm:h-9 px-3 rounded-lg button-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-raised)] active:scale-[0.98] transition-[color,transform] duration-200 cursor-pointer"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              <Flag size={16} weight="regular" />
              <span>Report</span>
            </button>

            <Link
              href={`/papers/${paper.id}`}
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
              aria-label="Open full paper page"
            >
              <ArrowSquareOut size={16} weight="regular" />
            </Link>

            <a
              href={`/api/v1/papers/${paper.id}/download`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-10 sm:h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] transition-[background-color,transform] duration-200"
            >
              <DownloadSimple size={16} weight="regular" />
              <span>Download PDF</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] cursor-pointer"
            >
              <X size={18} weight="regular" />
            </button>
          </div>
        </div>

        {reportOpen && (
          <form
            onSubmit={handleReportSubmit}
            className="rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              aria-label="Report reason"
              className="h-10 sm:h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-primary)] text-[var(--text-primary)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional note for admin"
              aria-label="Optional report details"
              className="flex-1 h-10 sm:h-9 px-3 rounded-lg body-6 bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
            <button
              type="submit"
              disabled={reportStatus === "submitting"}
              className="h-10 sm:h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {reportStatus === "submitting" ? "Sending" : "Submit report"}
            </button>
            {reportMessage && (
              <span
                className="caption-4"
                style={{
                  color:
                    reportStatus === "error"
                      ? "var(--badge-rejected-text)"
                      : "var(--badge-regular-text)",
                }}
              >
                {reportMessage}
              </span>
            )}
          </form>
        )}

        <div className="flex-1 min-h-0">
          <PdfViewer
            src={`/api/v1/papers/${paper.id}/view`}
            title={`${paper.subjectCode} ${paper.subjectName}`}
          />
        </div>

        <div className="flex items-center justify-between caption-5 text-[var(--text-muted)] font-mono tabular-nums">
          <span>
            {formatFileSize(paper.fileSizeBytes)} · {paper.pageCount} pages
            {paper.setLabel ? ` · ${paper.setLabel}` : ""}
          </span>
          <span>
            {paper.downloadCount} downloads · {paper.trackingCode}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PdfPreviewModal({ paper, onClose }: PdfPreviewModalProps) {
  if (!paper) return null;
  return <PdfPreviewDialogBody key={paper.id} paper={paper} onClose={onClose} />;
}

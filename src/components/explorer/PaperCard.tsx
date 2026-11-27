"use client";

import { memo } from "react";
import { DownloadSimple, Eye, FilePdf } from "@phosphor-icons/react";
import type { PaperDto } from "@/types/paper";
import {
  formatExamMonth,
  formatFileSize,
  formatYearSemCode,
} from "@/lib/btech";
import { ExamTypeBadge } from "@/components/ui/ExamBadge";

interface PaperCardProps {
  paper: PaperDto;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onPreview: (paper: PaperDto) => void;
}

export const PaperCard = memo(function PaperCard({
  paper,
  selected,
  onToggleSelect,
  onPreview,
}: PaperCardProps) {
  const yearSem = formatYearSemCode(paper.yearOfStudy, paper.semester);
  const session = `${formatExamMonth(paper.examMonth)} ${paper.examYear}`;

  return (
    <article
      className="reveal-up paper-card-perf catalog-card catalog-card-static rounded-2xl flex flex-col sm:flex-row sm:items-stretch justify-between gap-0"
      style={
        selected
          ? { border: "1.5px solid var(--action-primary)" }
          : undefined
      }
    >
      {/* ── Ruled archival docket area ── */}
      <div className="catalog-card-ruled flex items-start gap-3 min-w-0 px-4 pt-3.5 pb-3 sm:py-4 flex-1">
        <label className="pt-0.5 flex items-center cursor-pointer min-w-[22px] min-h-[26px] shrink-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(paper.id)}
            aria-label={`Select ${paper.subjectCode} ${paper.subjectName}`}
            className="w-4 h-4 rounded accent-[#1D4ED8] transition-transform duration-150 active:scale-90 cursor-pointer"
          />
        </label>

        <div
          className="hidden sm:flex w-11 h-11 rounded-xl shrink-0 items-center justify-center bg-[var(--surface-raised)] text-[var(--text-secondary)]"
          style={{ border: "1px solid var(--border-primary)" }}
          aria-hidden="true"
        >
          <FilePdf size={20} weight="regular" />
        </div>

        <div className="min-w-0 space-y-1.5 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span
                className="font-mono caption-4 px-2 py-0.5 rounded-md bg-[var(--surface-raised)] text-[var(--text-primary)]"
                style={{ border: "1px solid var(--border-primary)" }}
              >
                {paper.subjectCode}
              </span>
              <span className="font-mono caption-4 px-2 py-0.5 rounded-md bg-[var(--surface-raised)] text-[var(--text-secondary)]">
                {yearSem}
              </span>
              <span className="font-mono caption-4 text-[var(--text-muted)]">
                {paper.branchCode} · {paper.regulationCode}
              </span>
            </div>
            <div className="shrink-0">
              <ExamTypeBadge examType={paper.examType} />
            </div>
          </div>

          <h3 className="text-[16px] sm:text-[17px] font-medium text-[var(--text-primary)] leading-snug">
            {paper.subjectName}
          </h3>

          <p className="caption-5 text-[var(--text-muted)] font-mono tabular-nums truncate">
            {session}
            {paper.setLabel ? ` · ${paper.setLabel}` : ""} ·{" "}
            {formatFileSize(paper.fileSizeBytes)} · {paper.pageCount}p ·{" "}
            {paper.downloadCount} downloads
          </p>
        </div>
      </div>

      {/* ── Perforated action docket stub ── */}
      <div
        className={`px-4 py-3 border-t border-dashed border-[var(--border-primary)] sm:border-t-0 sm:border-l sm:py-3.5 sm:px-4 flex items-center shrink-0 transition-colors duration-200 ${
          selected
            ? "bg-[var(--action-primary)]/[0.06]"
            : "bg-[var(--surface-raised)]/45"
        }`}
      >
        <div className="w-full grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPreview(paper)}
            className="group/prev tap-press inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3.5 rounded-xl sm:rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <Eye
              size={16}
              weight="regular"
              className="transition-transform duration-200 group-hover/prev:scale-110 group-active/prev:scale-95"
            />
            <span>Preview</span>
          </button>

          <a
            href={`/api/v1/papers/${paper.id}/download`}
            className="group/dl tap-press inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3.5 rounded-xl sm:rounded-lg button-sm text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          >
            <DownloadSimple
              size={16}
              weight="regular"
              className="transition-transform duration-200 group-hover/dl:translate-y-0.5 group-active/dl:translate-y-1"
            />
            <span>Download</span>
          </a>
        </div>
      </div>
    </article>
  );
});

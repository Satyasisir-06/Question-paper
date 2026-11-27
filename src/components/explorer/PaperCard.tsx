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
      className="paper-card-perf rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--border-strong)]"
      style={{
        backgroundColor: "var(--surface-primary)",
        border: selected
          ? "1.5px solid var(--action-primary)"
          : "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <label className="pt-0.5 flex items-center cursor-pointer min-w-[22px] min-h-[26px] shrink-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(paper.id)}
            aria-label={`Select ${paper.subjectCode} ${paper.subjectName}`}
            className="w-4 h-4 rounded accent-[#1D4ED8] cursor-pointer"
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
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono caption-4 px-2 py-0.5 rounded-md bg-[var(--surface-raised)] text-[var(--text-primary)]">
              {paper.subjectCode}
            </span>
            <span className="font-mono caption-4 px-2 py-0.5 rounded-md bg-[var(--surface-raised)] text-[var(--text-secondary)]">
              {yearSem}
            </span>
            <span className="font-mono caption-4 text-[var(--text-muted)]">
              {paper.branchCode} · {paper.regulationCode}
            </span>
            <ExamTypeBadge examType={paper.examType} />
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

      <div className="pt-2.5 sm:pt-0 border-t border-[var(--border-primary)] sm:border-t-0 grid grid-cols-2 sm:flex items-center gap-2 shrink-0 sm:self-center">
        <button
          type="button"
          onClick={() => onPreview(paper)}
          className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3.5 rounded-xl sm:rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 active:scale-[0.98] transition-[opacity,transform] duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          <Eye size={16} weight="regular" />
          <span>Preview</span>
        </button>

        <a
          href={`/api/v1/papers/${paper.id}/download`}
          className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3.5 rounded-xl sm:rounded-lg button-sm text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] active:scale-[0.98] transition-[background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
        >
          <DownloadSimple size={16} weight="regular" />
          <span>Download</span>
        </a>
      </div>
    </article>
  );
});

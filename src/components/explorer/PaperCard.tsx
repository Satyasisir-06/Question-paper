"use client";

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

export function PaperCard({
  paper,
  selected,
  onToggleSelect,
  onPreview,
}: PaperCardProps) {
  const yearSem = formatYearSemCode(paper.yearOfStudy, paper.semester);
  const session = `${formatExamMonth(paper.examMonth)} ${paper.examYear}`;

  return (
    <article
      className="rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        backgroundColor: "var(--surface-primary)",
        border: selected
          ? "1px solid #2563EB"
          : "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <label className="pt-1 flex items-center cursor-pointer min-w-[24px] min-h-[24px]">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(paper.id)}
            aria-label={`Select ${paper.subjectCode} ${paper.subjectName}`}
            className="w-4 h-4 rounded accent-[#2563EB] cursor-pointer"
          />
        </label>

        <div
          className="hidden sm:flex w-10 h-10 rounded-lg shrink-0 items-center justify-center bg-[var(--surface-raised)] text-[var(--text-secondary)]"
          aria-hidden="true"
        >
          <FilePdf size={20} weight="regular" />
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-mono caption-4 px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-primary)]">
              {paper.subjectCode}
            </span>
            <span className="font-mono caption-4 px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-secondary)]">
              {yearSem}
            </span>
            <span className="font-mono caption-4 text-[var(--text-muted)]">
              {paper.branchCode} · {paper.regulationCode}
            </span>
            <ExamTypeBadge examType={paper.examType} />
          </div>

          <h3 className="title-3 text-[var(--text-primary)] leading-snug">
            {paper.subjectName}
          </h3>

          <p className="caption-5 text-[var(--text-muted)] font-mono tabular-nums">
            {session}
            {paper.setLabel ? ` · ${paper.setLabel}` : ""} ·{" "}
            {formatFileSize(paper.fileSizeBytes)} · {paper.pageCount}p ·{" "}
            {paper.downloadCount} downloads
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0 sm:self-center pt-1 sm:pt-0">
        <button
          type="button"
          onClick={() => onPreview(paper)}
          className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 active:scale-[0.98] transition-[opacity,transform] duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          <Eye size={16} weight="regular" />
          <span>Preview</span>
        </button>

        <a
          href={`/api/v1/papers/${paper.id}/download`}
          className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] transition-[background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <DownloadSimple size={16} weight="regular" />
          <span>Download</span>
        </a>
      </div>
    </article>
  );
}

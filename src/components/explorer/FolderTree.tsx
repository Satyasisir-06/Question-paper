"use client";

import { useState } from "react";
import {
  CaretDown,
  CaretRight,
  DownloadSimple,
  Eye,
  FilePdf,
  Folder,
  FolderOpen,
} from "@phosphor-icons/react";
import type { FolderTreeYearDto, PaperDto } from "@/types/paper";
import { formatExamMonth } from "@/lib/btech";
import { ExamTypeBadge } from "@/components/ui/ExamBadge";

interface FolderTreeProps {
  tree: FolderTreeYearDto[];
  onPreview: (paper: PaperDto) => void;
  onDownloadFolderZip: (filter: {
    year?: number;
    sem?: number;
    branch?: string;
  }) => void;
}

export function FolderTree({
  tree,
  onPreview,
  onDownloadFolderZip,
}: FolderTreeProps) {
  const [openYears, setOpenYears] = useState<Record<number, boolean>>({
    1: true,
    2: true,
  });
  const [openSems, setOpenSems] = useState<Record<number, boolean>>({
    4: true,
  });

  const toggleYear = (y: number) =>
    setOpenYears((prev) => ({ ...prev, [y]: !prev[y] }));

  const toggleSem = (s: number) =>
    setOpenSems((prev) => ({ ...prev, [s]: !prev[s] }));

  return (
    <div className="space-y-3">
      {tree.map((yearNode) => {
        const isYearOpen = Boolean(openYears[yearNode.yearOfStudy]);
        return (
          <div
            key={yearNode.yearOfStudy}
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--surface-primary)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <div className="px-3.5 sm:px-4 py-3 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => toggleYear(yearNode.yearOfStudy)}
                className="flex items-center gap-2 text-left text-[var(--text-primary)] cursor-pointer min-w-0"
              >
                {isYearOpen ? (
                  <CaretDown size={16} weight="regular" className="shrink-0" />
                ) : (
                  <CaretRight size={16} weight="regular" className="shrink-0" />
                )}
                {isYearOpen ? (
                  <FolderOpen size={18} weight="regular" className="text-[var(--action-primary)] shrink-0" />
                ) : (
                  <Folder size={18} weight="regular" className="text-[var(--text-muted)] shrink-0" />
                )}
                <span className="title-3 truncate">{yearNode.label}</span>
                <span className="font-mono caption-5 text-[var(--text-muted)] tabular-nums shrink-0">
                  {yearNode.paperCount} papers
                </span>
              </button>

              {yearNode.paperCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onDownloadFolderZip({ year: yearNode.yearOfStudy })
                  }
                  className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-2.5 rounded-lg caption-4 text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 shrink-0 cursor-pointer"
                  style={{ border: "1px solid var(--border-primary)" }}
                >
                  <DownloadSimple size={14} weight="regular" />
                  <span className="hidden xs:inline">ZIP folder</span>
                  <span className="xs:hidden">ZIP</span>
                </button>
              )}
            </div>

            {isYearOpen && (
              <div className="px-3 sm:px-4 pb-3 space-y-2.5">
                {yearNode.semesters.map((semNode) => {
                  const isSemOpen = Boolean(openSems[semNode.semester]);
                  return (
                    <div
                      key={semNode.semester}
                      className="rounded-xl p-2.5 sm:p-3 bg-[var(--surface-raised)]/75"
                      style={{ border: "1px solid var(--border-primary)" }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSem(semNode.semester)}
                          className="flex items-center gap-2 text-left text-[var(--text-primary)] cursor-pointer min-w-0"
                        >
                          {isSemOpen ? (
                            <CaretDown size={14} weight="regular" className="shrink-0" />
                          ) : (
                            <CaretRight size={14} weight="regular" className="shrink-0" />
                          )}
                          <span className="font-mono caption-4 px-1.5 py-0.5 rounded bg-[var(--surface-primary)] shrink-0">
                            {semNode.code}
                          </span>
                          <span className="title-4 truncate">{semNode.label}</span>
                          <span className="font-mono caption-5 text-[var(--text-muted)] tabular-nums shrink-0">
                            {semNode.paperCount}
                          </span>
                        </button>

                        {semNode.paperCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onDownloadFolderZip({
                                year: semNode.yearOfStudy,
                                sem: semNode.semester,
                              })
                            }
                            className="inline-flex items-center gap-1 h-8 sm:h-7 px-2 rounded-md caption-4 text-[var(--action-primary)] hover:bg-[var(--surface-primary)] cursor-pointer"
                          >
                            <DownloadSimple size={14} weight="regular" />
                            <span>Download sem ZIP</span>
                          </button>
                        )}
                      </div>

                      {isSemOpen && (
                        <div className="mt-2.5 pl-2.5 sm:pl-3 border-l border-[var(--border-strong)] space-y-2">
                          {semNode.branches.length === 0 ? (
                            <p className="caption-5 text-[var(--text-muted)] py-1">
                              No approved papers in this semester yet
                            </p>
                          ) : (
                            semNode.branches.map((br) => (
                              <div
                                key={br.branchCode}
                                className="rounded-xl p-2.5 sm:p-3 bg-[var(--surface-primary)] space-y-2"
                                style={{ border: "1px solid var(--border-primary)" }}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono caption-4 text-[var(--text-primary)]">
                                      {br.branchCode}
                                    </span>
                                    <span className="caption-5 text-[var(--text-muted)]">
                                      {br.regularCount} Regular · {br.supplyCount} Supply
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDownloadFolderZip({
                                        year: semNode.yearOfStudy,
                                        sem: semNode.semester,
                                        branch: br.branchCode,
                                      })
                                    }
                                    className="caption-4 text-[var(--action-primary)] hover:underline cursor-pointer"
                                  >
                                    Download {br.branchCode} ZIP
                                  </button>
                                </div>

                                <div className="divide-y divide-[var(--border-primary)]">
                                  {br.papers.map((p) => (
                                    <div
                                      key={p.id}
                                      className="py-2 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    >
                                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                                        <FilePdf
                                          size={15}
                                          weight="regular"
                                          className="text-[var(--text-muted)] shrink-0"
                                        />
                                        <span className="font-mono caption-4 text-[var(--text-primary)]">
                                          {p.subjectCode}
                                        </span>
                                        <span className="body-6 text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-xs">
                                          {p.subjectName}
                                        </span>
                                        <ExamTypeBadge examType={p.examType} />
                                        <span className="font-mono caption-5 text-[var(--text-muted)]">
                                          {formatExamMonth(p.examMonth)} {p.examYear}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => onPreview(p)}
                                          className="inline-flex items-center gap-1 h-8 sm:h-7 px-2.5 rounded-lg caption-4 text-[var(--text-primary)] bg-[var(--surface-raised)] cursor-pointer"
                                        >
                                          <Eye size={14} weight="regular" />
                                          <span>View</span>
                                        </button>
                                        <a
                                          href={`/api/v1/papers/${p.id}/download`}
                                          className="inline-flex items-center gap-1 h-8 sm:h-7 px-2.5 rounded-lg caption-4 text-[var(--action-primary)] bg-[var(--surface-raised)] hover:underline"
                                        >
                                          <DownloadSimple size={14} weight="regular" />
                                          <span>PDF</span>
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

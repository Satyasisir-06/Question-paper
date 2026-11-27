"use client";

import { YEAR_SEM_OPTIONS, type ExamTypeValue } from "@/lib/btech";

interface YearSemMatrixProps {
  selectedYear?: number;
  selectedSem?: number;
  selectedExamType?: ExamTypeValue;
  onSelectYearSem: (year?: number, sem?: number) => void;
  onSelectExamType: (examType?: ExamTypeValue) => void;
}

const EXAM_TABS: Array<{ value?: ExamTypeValue; label: string }> = [
  { value: undefined, label: "All papers" },
  { value: "REGULAR", label: "Regular" },
  { value: "SUPPLY", label: "Supply" },
  { value: "MID_1", label: "Mid 1" },
  { value: "MID_2", label: "Mid 2" },
];

export function YearSemMatrix({
  selectedYear,
  selectedSem,
  selectedExamType,
  onSelectYearSem,
  onSelectExamType,
}: YearSemMatrixProps) {
  return (
    <section
      aria-label="Academic year, semester, and exam filters"
      className="pt-3 border-t border-[var(--border-primary)] sm:pt-4 sm:p-4 sm:rounded-2xl sm:bg-[var(--surface-primary)] sm:border sm:border-[var(--border-primary)] sm:shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <p className="caption-4 text-[var(--text-secondary)]">
              Year and semester
            </p>
            {(selectedYear !== undefined || selectedSem !== undefined) && (
              <button
                type="button"
                onClick={() => onSelectYearSem(undefined, undefined)}
                className="sm:hidden caption-4 text-[var(--action-primary)]"
              >
                Show all
              </button>
            )}
          </div>
          <div className="flex sm:flex-wrap items-center gap-1 overflow-x-auto no-scrollbar scroll-fade-x pr-5 sm:pr-0 pb-0.5 sm:pb-0 p-0.5 sm:p-0">
            <button
              type="button"
              onClick={() => onSelectYearSem(undefined, undefined)}
              className={`tap-press shrink-0 h-10 sm:h-8 px-3.5 sm:px-2.5 rounded-xl sm:rounded-lg caption-4 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                selectedYear === undefined && selectedSem === undefined
                  ? "bg-[var(--action-primary)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              style={
                selectedYear === undefined && selectedSem === undefined
                  ? undefined
                  : { border: "1px solid var(--border-primary)" }
              }
            >
              All
            </button>
            {YEAR_SEM_OPTIONS.map((opt) => {
              const active = selectedYear === opt.year && selectedSem === opt.sem;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onSelectYearSem(opt.year, opt.sem)}
                  aria-pressed={active}
                  title={opt.label}
                  className={`tap-press shrink-0 h-10 sm:h-8 px-3.5 sm:px-2.5 rounded-xl sm:rounded-lg font-mono caption-4 tabular-nums whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                    active
                      ? "bg-[var(--action-primary)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                      : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                  style={
                    active
                      ? undefined
                      : { border: "1px solid var(--border-primary)" }
                  }
                >
                  {opt.code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <p className="caption-4 text-[var(--text-secondary)]">
            Exam category<span className="hidden sm:inline"> (Regular or Supply)</span>
          </p>
          <div
            role="group"
            aria-label="Exam category filter"
            className="flex sm:inline-flex items-center gap-1 p-1 rounded-xl sm:rounded-lg bg-[var(--surface-raised)] overflow-x-auto no-scrollbar"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {EXAM_TABS.map((tab) => {
              const active = selectedExamType === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => onSelectExamType(tab.value)}
                  aria-pressed={active}
                  className={`tap-press shrink-0 h-9 sm:h-7 px-3 sm:px-2.5 rounded-lg sm:rounded-md caption-4 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                    active
                      ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

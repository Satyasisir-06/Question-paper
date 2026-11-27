"use client";

import { Funnel, X } from "@phosphor-icons/react";
import type { FilterCatalogDto } from "@/types/paper";

interface FilterSidebarProps {
  catalog: FilterCatalogDto;
  selectedBranch: string;
  selectedRegulation: string;
  selectedExamYear: string;
  sortOrder: "newest" | "most_downloaded" | "subject_code";
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onBranchChange: (code: string) => void;
  onRegulationChange: (code: string) => void;
  onExamYearChange: (year: string) => void;
  onSortChange: (sort: "newest" | "most_downloaded" | "subject_code") => void;
  onReset: () => void;
}

export function FilterSidebar({
  catalog,
  selectedBranch,
  selectedRegulation,
  selectedExamYear,
  sortOrder,
  mobileOpen,
  onCloseMobile,
  onBranchChange,
  onRegulationChange,
  onExamYearChange,
  onSortChange,
  onReset,
}: FilterSidebarProps) {
  const sidebarContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Funnel size={16} weight="regular" aria-hidden="true" />
          <span className="title-4">Filters</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="caption-4 text-[var(--action-primary)] hover:underline cursor-pointer"
        >
          Reset all
        </button>
      </div>

      <div>
        <h3 className="caption-4 text-[var(--text-muted)] mb-2">Branch</h3>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onBranchChange("")}
            className={`w-full h-10 lg:h-9 px-3 lg:px-2.5 rounded-xl lg:rounded-lg flex items-center justify-between body-6 transition-colors duration-200 cursor-pointer ${
              selectedBranch === ""
                ? "bg-[var(--surface-raised)] text-[var(--text-primary)] font-medium"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>All branches</span>
          </button>
          {catalog.branches.map((branch) => {
            const active = selectedBranch === branch.code;
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => onBranchChange(active ? "" : branch.code)}
                title={branch.name}
                className={`w-full min-h-10 lg:min-h-9 py-1.5 px-3 lg:px-2.5 rounded-xl lg:rounded-lg flex items-center gap-2.5 text-left transition-colors duration-200 cursor-pointer ${
                  active
                    ? "bg-[var(--surface-raised)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="w-14 shrink-0 font-mono caption-4 text-[var(--text-primary)]">
                  {branch.code}
                </span>
                <span className="text-xs leading-snug line-clamp-2 flex-1">
                  {branch.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label
            htmlFor="filter-regulation"
            className="block caption-4 text-[var(--text-muted)] mb-1.5"
          >
            Regulation
          </label>
          <select
            id="filter-regulation"
            value={selectedRegulation}
            onChange={(e) => onRegulationChange(e.target.value)}
            className="w-full h-11 lg:h-9 px-3 lg:px-2.5 rounded-xl lg:rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <option value="">All regulations</option>
            {catalog.regulations.map((reg) => (
              <option key={reg.id} value={reg.code}>
                {reg.code} ({reg.startYear})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-exam-year"
            className="block caption-4 text-[var(--text-muted)] mb-1.5"
          >
            Exam year
          </label>
          <select
            id="filter-exam-year"
            value={selectedExamYear}
            onChange={(e) => onExamYearChange(e.target.value)}
            className="w-full h-11 lg:h-9 px-3 lg:px-2.5 rounded-xl lg:rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <option value="">All years</option>
            {catalog.examYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-sort"
            className="block caption-4 text-[var(--text-muted)] mb-1.5"
          >
            Sort by
          </label>
          <select
            id="filter-sort"
            value={sortOrder}
            onChange={(e) =>
              onSortChange(
                e.target.value as "newest" | "most_downloaded" | "subject_code"
              )
            }
            className="w-full h-11 lg:h-9 px-3 lg:px-2.5 rounded-xl lg:rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <option value="newest">Newest exam session</option>
            <option value="most_downloaded">Most downloaded</option>
            <option value="subject_code">Subject code (A to Z)</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Filter question papers"
        className="hidden lg:block w-[272px] shrink-0 rounded-2xl p-4 self-start sticky top-20"
        style={{
          backgroundColor: "var(--surface-sidebar)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Filter question papers"
        >
          <div
            className="fade-in fixed inset-0 bg-black/45 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div
            className="sheet-up relative w-full max-w-lg max-h-[85dvh] rounded-t-[1.75rem] flex flex-col z-10 overflow-hidden"
            style={{
              backgroundColor: "var(--surface-primary)",
              borderTop: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
            </div>

            <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--border-primary)] shrink-0">
              <span className="title-3 text-[var(--text-primary)]">Refine archive</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close filters"
                className="tap-press inline-flex items-center justify-center w-10 h-10 rounded-full text-[var(--text-secondary)] bg-[var(--surface-raised)] cursor-pointer"
              >
                <X size={18} weight="regular" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {sidebarContent}
            </div>

            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-[var(--border-primary)] bg-[var(--surface-primary)] shrink-0">
              <button
                type="button"
                onClick={onCloseMobile}
                className="tap-press w-full h-12 rounded-xl button-md text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              >
                Show matching papers
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

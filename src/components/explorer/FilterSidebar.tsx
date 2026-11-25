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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Funnel size={16} weight="regular" aria-hidden="true" />
          <span className="title-4">Filters</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="caption-4 text-[#2563EB] hover:underline cursor-pointer"
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
            className={`w-full h-9 px-2.5 rounded-lg flex items-center justify-between body-6 transition-colors duration-200 cursor-pointer ${
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
                className={`w-full h-9 px-2.5 rounded-lg flex items-center justify-between body-6 transition-colors duration-200 cursor-pointer ${
                  active
                    ? "bg-[var(--surface-raised)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="truncate">{branch.name}</span>
                <span className="font-mono caption-5 text-[var(--text-muted)] ml-2 shrink-0">
                  {branch.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="filter-regulation"
          className="block caption-4 text-[var(--text-muted)] mb-2"
        >
          Regulation
        </label>
        <select
          id="filter-regulation"
          value={selectedRegulation}
          onChange={(e) => onRegulationChange(e.target.value)}
          className="w-full h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
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
          className="block caption-4 text-[var(--text-muted)] mb-2"
        >
          Exam year
        </label>
        <select
          id="filter-exam-year"
          value={selectedExamYear}
          onChange={(e) => onExamYearChange(e.target.value)}
          className="w-full h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
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
          className="block caption-4 text-[var(--text-muted)] mb-2"
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
          className="w-full h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          <option value="newest">Newest exam session</option>
          <option value="most_downloaded">Most downloaded</option>
          <option value="subject_code">Subject code (A to Z)</option>
        </select>
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Filter question papers"
        className="hidden lg:block w-[260px] shrink-0 rounded-xl p-4 self-start sticky top-20"
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
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Filter question papers"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div
            className="relative w-full max-w-xs h-full p-4 overflow-y-auto z-10"
            style={{
              backgroundColor: "var(--surface-primary)",
              borderRight: "1px solid var(--border-primary)",
            }}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-primary)]">
              <span className="title-3 text-[var(--text-primary)]">Filters</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close filters"
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} weight="regular" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

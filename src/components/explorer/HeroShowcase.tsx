"use client";

import Link from "next/link";
import { ArrowDown, Books, Folder, UploadSimple } from "@phosphor-icons/react";
import type { FilterCatalogDto } from "@/types/paper";

interface HeroShowcaseProps {
  catalog: FilterCatalogDto;
  totalCatalogPapers: number;
  selectedBranch: string;
  selectedYear?: number;
  selectedSem?: number;
  onQuickBranch: (branchCode: string) => void;
  onQuickYearSem: (year?: number, sem?: number) => void;
  onJumpToArchive: () => void;
}

const FEATURED_SEMESTERS = [
  { year: 1, sem: 1, tag: "Sem 1-1", title: "1st Year Foundation" },
  { year: 2, sem: 4, tag: "Sem 2-2", title: "Core CS & Circuits" },
  { year: 3, sem: 5, tag: "Sem 3-1", title: "Systems & ML Track" },
  { year: 4, sem: 7, tag: "Sem 4-1", title: "Senior Electives" },
] as const;

export function HeroShowcase({
  catalog,
  totalCatalogPapers,
  selectedBranch,
  selectedYear,
  selectedSem,
  onQuickBranch,
  onQuickYearSem,
  onJumpToArchive,
}: HeroShowcaseProps) {
  const scrollToExplorer = () => {
    const target = document.getElementById("archive-explorer");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const yearSpanLabel = (() => {
    if (catalog.examYears.length === 0) return "R20-R23";
    const latest = catalog.examYears[0];
    const earliest = catalog.examYears[catalog.examYears.length - 1];
    return earliest === latest ? String(latest) : `${earliest}-${latest}`;
  })();

  return (
    <section
      aria-label="Archive overview and quick access"
      className="pt-2 pb-4 sm:pt-4 sm:pb-6 border-b border-[var(--border-primary)]"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--surface-raised)] border border-[var(--border-primary)] caption-4 text-[var(--text-secondary)]">
            <Books size={14} weight="regular" aria-hidden="true" />
            <span>Exam cell verified archive</span>
          </div>

          <h1 className="heading-hero text-[var(--text-primary)]">
            B.Tech question paper archive
          </h1>

          <p className="body-5 text-[var(--text-secondary)] max-w-[54ch]">
            Find previous Regular and Supply exam booklets in seconds, inspect every page inline, or bundle a semester folder as ZIP.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onJumpToArchive}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg button-md text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              <ArrowDown size={16} weight="regular" aria-hidden="true" />
              <span>Browse archive</span>
            </button>

            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg button-md text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 active:scale-[0.98] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              <UploadSimple size={16} weight="regular" aria-hidden="true" />
              <span>Upload paper</span>
            </Link>
          </div>

          <dl className="pt-2 grid grid-cols-3 gap-4 max-w-md border-t border-[var(--border-primary)]">
            <div>
              <dt className="caption-5 text-[var(--text-muted)]">Verified papers</dt>
              <dd className="mt-0.5 text-xl sm:text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                {totalCatalogPapers}
              </dd>
            </div>
            <div>
              <dt className="caption-5 text-[var(--text-muted)]">Branches</dt>
              <dd className="mt-0.5 text-xl sm:text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                {catalog.branches.length}
              </dd>
            </div>
            <div>
              <dt className="caption-5 text-[var(--text-muted)]">Subjects</dt>
              <dd className="mt-0.5 text-xl sm:text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                {catalog.subjects.length}
              </dd>
            </div>
          </dl>
        </div>

        <div
          className="hidden lg:block lg:col-span-5 rounded-2xl p-5 space-y-4"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <Folder size={16} weight="regular" aria-hidden="true" />
              <span className="title-4">Quick semester jump</span>
            </div>
            <span className="font-mono caption-5 text-[var(--text-muted)] tabular-nums">
              {yearSpanLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {FEATURED_SEMESTERS.map((item) => {
              const active = selectedYear === item.year && selectedSem === item.sem;
              return (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => {
                    onQuickYearSem(active ? undefined : item.year, active ? undefined : item.sem);
                    scrollToExplorer();
                  }}
                  className={`p-3 rounded-xl text-left transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    active
                      ? "bg-[#2563EB] text-white"
                      : "bg-[var(--surface-raised)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  }`}
                  style={{
                    border: active ? "1px solid #2563EB" : "1px solid var(--border-primary)",
                  }}
                >
                  <div className="font-mono caption-4 opacity-85">{item.tag}</div>
                  <div className="title-4 mt-1">{item.title}</div>
                </button>
              );
            })}
          </div>

          {catalog.branches.length > 0 && (
            <div className="pt-1 space-y-2">
              <p className="caption-4 text-[var(--text-muted)]">Jump by department</p>
              <div className="grid grid-cols-3 gap-1.5">
                {catalog.branches.slice(0, 9).map((br) => {
                  const active = selectedBranch === br.code;
                  return (
                    <button
                      key={br.id}
                      type="button"
                      onClick={() => {
                        onQuickBranch(active ? "" : br.code);
                        scrollToExplorer();
                      }}
                      title={br.name}
                      className={`h-8 px-2 rounded-lg font-mono caption-4 text-center transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                        active
                          ? "bg-[#2563EB] text-white"
                          : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {br.code}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Folder,
  Funnel,
  ListBullets,
  MagnifyingGlass,
  Package,
  UploadSimple,
} from "@phosphor-icons/react";
import type {
  FilterCatalogDto,
  FolderTreeYearDto,
  PaperDto,
} from "@/types/paper";
import { EXAM_TYPE_META, type ExamTypeValue } from "@/lib/btech";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { HeroShowcase } from "@/components/explorer/HeroShowcase";
import { YearSemMatrix } from "@/components/explorer/YearSemMatrix";
import { FilterSidebar } from "@/components/explorer/FilterSidebar";
import { PaperCard } from "@/components/explorer/PaperCard";
import { safeReadApiJson } from "@/lib/httpClient";

const FolderTree = dynamic(
  () => import("@/components/explorer/FolderTree").then((mod) => mod.FolderTree),
  {
    loading: () => (
      <div className="space-y-3">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-20 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]"
          />
        ))}
      </div>
    ),
  }
);

const PdfPreviewModal = dynamic(
  () => import("@/components/pdf/PdfPreviewModal").then((mod) => mod.PdfPreviewModal),
  { ssr: false }
);

interface ExplorerClientProps {
  initialCatalog: FilterCatalogDto;
  initialPapers: PaperDto[];
  initialTotal: number;
  initialError?: string;
}

export function ExplorerClient({
  initialCatalog,
  initialPapers,
  initialTotal,
  initialError = "",
}: ExplorerClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [year, setYear] = useState<number | undefined>(undefined);
  const [sem, setSem] = useState<number | undefined>(undefined);
  const [examType, setExamType] = useState<ExamTypeValue | undefined>(undefined);
  const [branch, setBranch] = useState("");
  const [regulation, setRegulation] = useState("");
  const [examYear, setExamYear] = useState("");
  const [sort, setSort] = useState<"newest" | "most_downloaded" | "subject_code">(
    "newest"
  );

  const [viewMode, setViewMode] = useState<"cards" | "folders">("cards");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [papers, setPapers] = useState<PaperDto[]>(initialPapers);
  const [total, setTotal] = useState<number>(initialTotal);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError);

  const [treeData, setTreeData] = useState<FolderTreeYearDto[] | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipNotice, setZipNotice] = useState("");
  const [previewPaper, setPreviewPaper] = useState<PaperDto | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const qs = new URLSearchParams();
      if (searchQuery.trim()) qs.set("q", searchQuery.trim());
      if (year !== undefined) qs.set("year", String(year));
      if (sem !== undefined) qs.set("sem", String(sem));
      if (examType) qs.set("examType", examType);
      if (branch) qs.set("branch", branch);
      if (regulation) qs.set("regulation", regulation);
      if (examYear) qs.set("examYear", examYear);
      qs.set("sort", sort);
      qs.set("limit", "40");

      const res = await fetch(`/api/v1/papers?${qs.toString()}`);
      const parsed = await safeReadApiJson<PaperDto[]>(
        res,
        "Unable to load question papers."
      );
      if (!parsed.ok || !parsed.data) {
        setErrorMsg(parsed.errorMessage);
        return;
      }
      setPapers(parsed.data);
      setTotal(parsed.meta?.total ?? parsed.data.length);
      setSelectedIds([]);
    } catch {
      setErrorMsg("Unable to reach archive API.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, year, sem, examType, branch, regulation, examYear, sort]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void fetchPapers();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchPapers]);

  const loadFolderTree = useCallback(async () => {
    if (treeData !== null) return;
    setTreeLoading(true);
    try {
      const res = await fetch("/api/v1/papers/tree");
      const parsed = await safeReadApiJson<FolderTreeYearDto[]>(
        res,
        "Unable to load folder tree."
      );
      if (parsed.ok && parsed.data) {
        setTreeData(parsed.data);
      } else if (!parsed.ok) {
        setErrorMsg(parsed.errorMessage);
      }
    } finally {
      setTreeLoading(false);
    }
  }, [treeData]);

  const handleSwitchView = (next: "cards" | "folders") => {
    setViewMode(next);
    if (next === "folders") {
      void loadFolderTree();
    }
  };

  const triggerZipDownload = async (
    payload:
      | { paperIds: string[] }
      | {
          filter: {
            q?: string;
            year?: number;
            sem?: number;
            branch?: string;
            regulation?: string;
            examType?: ExamTypeValue;
            examYear?: number;
          };
        }
  ) => {
    setZipDownloading(true);
    setZipNotice("");
    try {
      const res = await fetch("/api/v1/papers/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        setZipNotice(
          errJson?.error?.message ?? "Unable to build PDF folder archive."
        );
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "BTech_Question_Papers.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setZipNotice("Network error while downloading folder archive.");
    } finally {
      setZipDownloading(false);
    }
  };

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setYear(undefined);
    setSem(undefined);
    setExamType(undefined);
    setBranch("");
    setRegulation("");
    setExamYear("");
    setSort("newest");
  }, []);

  const breadcrumbParts = useMemo(() => {
    const parts = ["B.Tech"];
    if (year !== undefined && sem !== undefined) {
      parts.push(`Year ${year} (Sem ${sem})`);
    }
    if (branch) parts.push(branch);
    if (regulation) parts.push(regulation);
    if (examType) parts.push(EXAM_TYPE_META[examType].label);
    return parts.join(" / ");
  }, [year, sem, branch, regulation, examType]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const uploadPrefillHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (year !== undefined) qs.set("year", String(year));
    if (sem !== undefined) qs.set("sem", String(sem));
    if (examType) qs.set("examType", examType);
    const query = qs.toString();
    return query ? `/upload?${query}` : "/upload";
  }, [year, sem, examType]);

  const activeFilterCount =
    (branch ? 1 : 0) + (regulation ? 1 : 0) + (examYear ? 1 : 0);

  const handleJumpToArchive = useCallback(() => {
    const target = document.getElementById("archive-explorer");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <SiteHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6"
      >
        <HeroShowcase
          branchCount={initialCatalog.branches.length}
          subjectCount={initialCatalog.subjects.length}
          totalCatalogPapers={initialTotal}
          onJumpToArchive={handleJumpToArchive}
        />

        <div id="archive-explorer" className="scroll-mt-20 space-y-3 sm:space-y-4">
          <div className="md:hidden relative">
            <MagnifyingGlass
              size={16}
              weight="regular"
              className="absolute left-3.5 top-3.5 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject code or name"
              aria-label="Search subject code or name"
              className="w-full h-11 pl-10 pr-3 rounded-xl text-base sm:text-sm bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>

          {initialCatalog.branches.length > 0 && (
            <div
              aria-label="Quick branch filter"
              className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
            >
              <button
                type="button"
                onClick={() => setBranch("")}
                className={`shrink-0 h-8 px-3 rounded-lg caption-4 transition-colors duration-200 cursor-pointer ${
                  branch === ""
                    ? "bg-[#2563EB] text-white"
                    : "bg-[var(--surface-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)]"
                }`}
              >
                All branches
              </button>
              {initialCatalog.branches.map((br) => {
                const active = branch === br.code;
                return (
                  <button
                    key={br.id}
                    type="button"
                    onClick={() => setBranch(active ? "" : br.code)}
                    className={`shrink-0 h-8 px-3 rounded-lg font-mono caption-4 transition-colors duration-200 cursor-pointer ${
                      active
                        ? "bg-[#2563EB] text-white"
                        : "bg-[var(--surface-primary)] text-[var(--text-secondary)] border border-[var(--border-primary)]"
                    }`}
                  >
                    {br.code}
                  </button>
                );
              })}
            </div>
          )}

          <YearSemMatrix
            selectedYear={year}
            selectedSem={sem}
            selectedExamType={examType}
            onSelectYearSem={(y, s) => {
              setYear(y);
              setSem(s);
            }}
            onSelectExamType={setExamType}
          />
        </div>

        <div className="flex items-start gap-6">
          <FilterSidebar
            catalog={initialCatalog}
            selectedBranch={branch}
            selectedRegulation={regulation}
            selectedExamYear={examYear}
            sortOrder={sort}
            mobileOpen={mobileFiltersOpen}
            onCloseMobile={() => setMobileFiltersOpen(false)}
            onBranchChange={setBranch}
            onRegulationChange={setRegulation}
            onExamYearChange={setExamYear}
            onSortChange={setSort}
            onReset={resetFilters}
          />

          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
            <div
              className="rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
              style={{
                backgroundColor: "var(--surface-primary)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] shrink-0"
                    style={{ border: "1px solid var(--border-primary)" }}
                  >
                    <Funnel size={15} weight="regular" />
                    <span>
                      Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                    </span>
                  </button>
                  <span className="font-mono caption-4 text-[var(--text-secondary)] truncate">
                    {breadcrumbParts}
                  </span>
                  <span className="font-mono caption-5 text-[var(--text-muted)] tabular-nums shrink-0">
                    · {total} {total === 1 ? "paper" : "papers"}
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="Browse view mode"
                  className="sm:hidden inline-flex p-0.5 rounded-lg bg-[var(--surface-raised)] shrink-0"
                  style={{ border: "1px solid var(--border-primary)" }}
                >
                  <button
                    type="button"
                    onClick={() => handleSwitchView("cards")}
                    aria-label="List view"
                    className={`inline-flex items-center justify-center w-9 h-8 rounded-md cursor-pointer ${
                      viewMode === "cards"
                        ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <ListBullets size={15} weight="regular" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchView("folders")}
                    aria-label="Folder view"
                    className={`inline-flex items-center justify-center w-9 h-8 rounded-md cursor-pointer ${
                      viewMode === "folders"
                        ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <Folder size={15} weight="regular" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Browse view mode"
                  className="hidden sm:inline-flex p-1 rounded-lg bg-[var(--surface-raised)]"
                  style={{ border: "1px solid var(--border-primary)" }}
                >
                  <button
                    type="button"
                    onClick={() => handleSwitchView("cards")}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md caption-4 cursor-pointer ${
                      viewMode === "cards"
                        ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <ListBullets size={15} weight="regular" />
                    <span>List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchView("folders")}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md caption-4 cursor-pointer ${
                      viewMode === "folders"
                        ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <Folder size={15} weight="regular" />
                    <span>Folders</span>
                  </button>
                </div>

                {viewMode === "cards" && total > 0 && (
                  <button
                    type="button"
                    disabled={zipDownloading}
                    onClick={() =>
                      triggerZipDownload({
                        filter: {
                          q: searchQuery.trim() || undefined,
                          year,
                          sem,
                          branch: branch || undefined,
                          regulation: regulation || undefined,
                          examType,
                          examYear: examYear ? Number(examYear) : undefined,
                        },
                      })
                    }
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-[opacity,transform] duration-200 cursor-pointer"
                    style={{ border: "1px solid var(--border-primary)" }}
                  >
                    <Package size={16} weight="regular" />
                    <span>
                      {zipDownloading ? "Packaging ZIP" : "Download folder (ZIP)"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {zipNotice && (
              <div
                role="status"
                className="rounded-xl px-4 py-3 body-6"
                style={{
                  backgroundColor: "var(--badge-rejected-bg)",
                  color: "var(--badge-rejected-text)",
                  border: "1px solid var(--badge-rejected-border)",
                }}
              >
                {zipNotice}
              </div>
            )}

            {selectedIds.length > 0 && viewMode === "cards" && (
              <div
                className="fixed bottom-3 inset-x-3 z-30 sm:static rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                style={{
                  backgroundColor: "var(--surface-primary)",
                  border: "1px solid #2563EB",
                  boxShadow: "var(--shadow-float)",
                }}
              >
                <span className="title-4 text-[var(--text-primary)] tabular-nums">
                  {selectedIds.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="h-9 sm:h-8 px-2.5 rounded-lg caption-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={zipDownloading}
                    onClick={() => triggerZipDownload({ paperIds: selectedIds })}
                    className="inline-flex items-center gap-2 h-9 sm:h-8 px-3 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    <Package size={15} weight="regular" />
                    <span>Download ZIP</span>
                  </button>
                </div>
              </div>
            )}

            {viewMode === "folders" ? (
              treeLoading || !treeData ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="h-20 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]"
                    />
                  ))}
                </div>
              ) : (
                <FolderTree
                  tree={treeData}
                  onPreview={setPreviewPaper}
                  onDownloadFolderZip={(filter) =>
                    triggerZipDownload({
                      filter: { ...filter, examType },
                    })
                  }
                />
              )
            ) : loading ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading papers">
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="rounded-xl p-4 h-24 bg-[var(--surface-primary)]"
                    style={{ border: "1px solid var(--border-primary)" }}
                  >
                    <div className="h-4 w-36 rounded bg-[var(--surface-raised)] mb-3" />
                    <div className="h-5 w-72 rounded bg-[var(--surface-raised)]" />
                  </div>
                ))}
              </div>
            ) : errorMsg ? (
              <div
                role="alert"
                className="rounded-xl p-6 text-center space-y-3"
                style={{
                  backgroundColor: "var(--surface-primary)",
                  border: "1px solid var(--badge-rejected-border)",
                }}
              >
                <p className="title-3 text-[var(--text-primary)]">
                  Could not load question papers
                </p>
                <p className="body-6 text-[var(--text-secondary)]">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => void fetchPapers()}
                  className="inline-flex items-center h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] cursor-pointer"
                >
                  Retry search
                </button>
              </div>
            ) : papers.length === 0 ? (
              <div
                className="rounded-xl p-8 text-center space-y-3"
                style={{
                  backgroundColor: "var(--surface-primary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <p className="title-3 text-[var(--text-primary)]">
                  No matching papers found for {breadcrumbParts}
                </p>
                <p className="body-6 text-[var(--text-secondary)] max-w-md mx-auto">
                  Try widening your filters or upload a copy of this question
                  paper for admin review.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="h-9 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] cursor-pointer"
                    style={{ border: "1px solid var(--border-primary)" }}
                  >
                    Reset filters
                  </button>
                  <Link
                    href={uploadPrefillHref}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
                  >
                    <UploadSimple size={16} weight="regular" />
                    <span>Upload paper</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {papers.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    selected={selectedIds.includes(paper.id)}
                    onToggleSelect={toggleSelect}
                    onPreview={setPreviewPaper}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--border-primary)] bg-[var(--surface-primary)] mt-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="title-4 text-[var(--text-primary)]">B.Tech PaperVault</p>
            <p className="caption-5 text-[var(--text-muted)]">
              Verified B.Tech Regular, Supply, and Midterm question paper index.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-4 caption-4 text-[var(--text-secondary)]">
            <Link href="/track" className="hover:text-[var(--text-primary)]">
              Track upload
            </Link>
            <Link href="/upload" className="text-[#2563EB] hover:underline">
              Upload paper
            </Link>
          </nav>
        </div>
      </footer>

      {previewPaper && (
        <PdfPreviewModal
          paper={previewPaper}
          onClose={() => setPreviewPaper(null)}
        />
      )}
    </div>
  );
}

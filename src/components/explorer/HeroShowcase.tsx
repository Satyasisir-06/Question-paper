"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowDown, Books, UploadSimple } from "@phosphor-icons/react";

const DitherVeil = dynamic(() => import("@/components/ui/DitherVeil"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full skeleton-bone"
      aria-hidden="true"
    />
  ),
});

interface HeroShowcaseProps {
  branchCount: number;
  subjectCount: number;
  totalCatalogPapers: number;
  onJumpToArchive: () => void;
}

function subscribeDarkClass(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getIsDark() {
  return document.documentElement.classList.contains("dark");
}

function getServerIsDark() {
  return false;
}

export function HeroShowcase({
  branchCount,
  subjectCount,
  totalCatalogPapers,
  onJumpToArchive,
}: HeroShowcaseProps) {
  const isDark = useSyncExternalStore(
    subscribeDarkClass,
    getIsDark,
    getServerIsDark
  );

  return (
    <section
      aria-label="Archive overview"
      className="pt-1 pb-6 sm:pt-4 sm:pb-9 border-b border-[var(--border-primary)]"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        <div className="lg:col-span-6 space-y-4 sm:space-y-5">
          <p className="inline-flex items-center gap-2 caption-4 text-[var(--text-secondary)]">
            <Books size={15} weight="regular" aria-hidden="true" />
            <span>Exam cell verified archive</span>
          </p>

          <h1 className="heading-hero text-[var(--text-primary)]">
            B.Tech question paper archive
          </h1>

          <p className="body-5 text-[var(--text-secondary)] max-w-[52ch]">
            Find previous Regular and Supply exam booklets in seconds, inspect every page inline, or bundle a semester folder as ZIP.
          </p>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
            <button
              type="button"
              onClick={onJumpToArchive}
              className="group inline-flex items-center justify-between sm:justify-center gap-2.5 h-12 sm:h-11 pl-4 pr-2 sm:px-5 rounded-full button-md text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] active:scale-[0.98] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
            >
              <span>Browse archive</span>
              <span
                className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-y-0.5"
                aria-hidden="true"
              >
                <ArrowDown size={15} weight="regular" />
              </span>
            </button>

            <Link
              href="/upload"
              className="group inline-flex items-center justify-between sm:justify-center gap-2.5 h-12 sm:h-11 pl-4 pr-2 sm:px-5 rounded-full button-md text-[var(--text-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-raised)] active:scale-[0.98] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
              style={{
                border: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <span>Upload paper</span>
              <span
                className="w-8 h-8 rounded-full bg-[var(--surface-raised)] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5"
                aria-hidden="true"
              >
                <UploadSimple size={15} weight="regular" />
              </span>
            </Link>
          </div>

          <dl className="pt-3.5 grid grid-cols-3 gap-4 max-w-md border-t border-[var(--border-primary)]">
            <div>
              <dt className="caption-5 text-[var(--text-muted)]">Verified papers</dt>
              <dd className="mt-0.5 font-mono text-lg sm:text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                {totalCatalogPapers}
              </dd>
            </div>
            <div>
              <dt className="caption-5 text-[var(--text-muted)]">Branches</dt>
              <dd className="mt-0.5 font-mono text-lg sm:text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                {branchCount}
              </dd>
            </div>
            <div>
              <dt className="caption-5 text-[var(--text-muted)]">Subjects</dt>
              <dd className="mt-0.5 font-mono text-lg sm:text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                {subjectCount}
              </dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-6">
          <div className="bezel-shell">
            <div className="bezel-core overflow-hidden">
              <div className="w-full h-[188px] sm:h-[250px] lg:h-[340px]">
                <DitherVeil
                  src="/images/hero-study.jpg"
                  alt="Engineering examination booklets and technical blueprint study desk"
                  fit="cover"
                  pattern="floyd"
                  pixelSize={2}
                  levels={2}
                  palette="duotone"
                  inkColor={isDark ? "#111110" : "#161614"}
                  paperColor={isDark ? "#EAE5DA" : "#F5F1E8"}
                  contrast={1.15}
                  brightness={0}
                  revealRadius={180}
                  softness={0.6}
                  linger={1}
                  rimColor={isDark ? "#3B82F6" : "#1D4ED8"}
                  rim={0.14}
                  wander={true}
                  clickBurst={true}
                />
              </div>
              <div className="px-3.5 py-2 flex items-center justify-between gap-2 border-t border-[var(--border-primary)] bg-[var(--surface-primary)]">
                <span className="font-mono text-[11px] text-[var(--text-muted)] truncate">
                  B.TECH ARCHIVE · R20–R23
                </span>
                <span className="font-mono text-[11px] text-[var(--text-secondary)] shrink-0 whitespace-nowrap">
                  PDF FOLIO
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface BoneProps {
  className?: string;
}

export function SkeletonBone({ className = "" }: BoneProps) {
  return <div aria-hidden="true" className={`skeleton-bone ${className}`} />;
}

export function HeaderSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="sticky top-0 z-30 h-14 bg-[var(--surface-primary)] border-b border-[var(--border-primary)]"
    >
      <div className="max-w-7xl mx-auto h-full px-3 sm:px-4 md:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SkeletonBone className="w-8 h-8 rounded-lg" />
          <SkeletonBone className="w-32 h-4 rounded-md" />
        </div>
        <SkeletonBone className="hidden md:block flex-1 max-w-md h-9 rounded-lg" />
        <div className="flex items-center gap-2">
          <SkeletonBone className="w-9 h-9 rounded-lg" />
          <SkeletonBone className="w-24 sm:w-28 h-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PaperCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading question papers"
      className="space-y-3"
    >
      <span className="sr-only">Loading question papers...</span>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl p-3.5 sm:p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)]"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <SkeletonBone className="hidden sm:block w-10 h-10 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <SkeletonBone className="h-5 w-16 rounded-md" />
                  <SkeletonBone className="h-5 w-10 rounded-md" />
                  <SkeletonBone className="h-5 w-14 rounded-md" />
                </div>
                <SkeletonBone className="h-5 w-3/4 max-w-xs rounded-md" />
                <SkeletonBone className="h-3.5 w-44 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <SkeletonBone className="h-9 sm:w-24 rounded-lg" />
              <SkeletonBone className="h-9 sm:w-28 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FolderTreeSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading folder tree"
      className="space-y-3"
    >
      <span className="sr-only">Loading archive folders...</span>
      {[1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="rounded-xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <SkeletonBone className="w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <SkeletonBone className="h-4 w-36 rounded-md" />
              <SkeletonBone className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <SkeletonBone className="h-8 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading B.Tech PaperVault">
      <span className="sr-only">Loading B.Tech question paper archive...</span>
      <HeaderSkeleton />

      <main className="max-w-7xl w-full mx-auto px-3.5 sm:px-4 md:px-6 py-5 sm:py-7 space-y-6 sm:space-y-8">
        <section className="pt-1 pb-6 sm:pt-4 sm:pb-8 border-b border-[var(--border-primary)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <SkeletonBone className="h-4 w-40 rounded-md" />
              <div className="space-y-2.5">
                <SkeletonBone className="h-9 sm:h-11 w-4/5 rounded-lg" />
                <SkeletonBone className="h-9 sm:h-11 w-3/5 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <SkeletonBone className="h-4 w-full max-w-md rounded-md" />
                <SkeletonBone className="h-4 w-2/3 max-w-sm rounded-md" />
              </div>
              <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3 pt-1">
                <SkeletonBone className="h-11 sm:w-40 rounded-lg" />
                <SkeletonBone className="h-11 sm:w-36 rounded-lg" />
              </div>
              <div className="pt-3 grid grid-cols-3 gap-4 max-w-md border-t border-[var(--border-primary)]">
                {[1, 2, 3].map((stat) => (
                  <div key={stat} className="space-y-1.5">
                    <SkeletonBone className="h-3 w-16 rounded" />
                    <SkeletonBone className="h-6 w-12 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div
                className="w-full h-[188px] sm:h-[250px] lg:h-[340px] rounded-2xl overflow-hidden p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] flex flex-col justify-between"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center justify-between">
                  <SkeletonBone className="h-4 w-24 rounded" />
                  <SkeletonBone className="h-4 w-12 rounded" />
                </div>
                <SkeletonBone className="flex-1 my-3 rounded-xl" />
                <div className="flex items-center gap-2">
                  <SkeletonBone className="h-3 w-20 rounded" />
                  <SkeletonBone className="h-3 w-14 rounded" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-2xl p-3.5 sm:p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-3">
          <SkeletonBone className="md:hidden h-11 w-full rounded-xl" />
          <div className="lg:hidden flex items-center gap-1.5 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((chip) => (
              <SkeletonBone key={chip} className="h-8 w-14 shrink-0 rounded-lg" />
            ))}
          </div>
          <div className="pt-2.5 border-t border-[var(--border-primary)] lg:pt-0 lg:border-t-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-hidden">
              {[1, 2, 3, 4, 5].map((yr) => (
                <SkeletonBone key={yr} className="h-8 w-12 shrink-0 rounded-lg" />
              ))}
            </div>
            <SkeletonBone className="h-9 w-full sm:w-64 rounded-lg" />
          </div>
        </div>

        <div className="flex items-start gap-6">
          <aside className="hidden lg:block w-64 shrink-0 rounded-xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-4">
            <SkeletonBone className="h-5 w-24 rounded" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((row) => (
                <SkeletonBone key={row} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="rounded-xl px-4 py-3 bg-[var(--surface-primary)] border border-[var(--border-primary)] flex items-center justify-between gap-3">
              <SkeletonBone className="h-5 w-36 rounded" />
              <div className="flex items-center gap-2">
                <SkeletonBone className="h-8 w-20 rounded-lg" />
                <SkeletonBone className="h-8 w-28 rounded-lg" />
              </div>
            </div>
            <PaperCardListSkeleton count={4} />
          </div>
        </div>
      </main>
    </div>
  );
}

export function UploadPageSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading upload form"
      className="max-w-[680px] mx-auto space-y-5"
    >
      <span className="sr-only">Loading upload form...</span>
      <SkeletonBone className="h-16 w-full rounded-xl" />
      <div className="rounded-2xl p-4 sm:p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBone className="h-5 w-52 rounded" />
          <SkeletonBone className="h-4 w-12 rounded" />
        </div>
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-5 space-y-3">
          <SkeletonBone className="w-10 h-10 mx-auto rounded-lg" />
          <SkeletonBone className="h-4 w-48 mx-auto rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <SkeletonBone className="h-11 rounded-xl" />
            <SkeletonBone className="h-11 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl p-4 sm:p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-4">
        <SkeletonBone className="h-5 w-44 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((field) => (
            <div key={field} className="space-y-1.5">
              <SkeletonBone className="h-3.5 w-24 rounded" />
              <SkeletonBone className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackPageSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading upload tracker"
      className="max-w-xl mx-auto space-y-5"
    >
      <span className="sr-only">Loading upload tracker...</span>
      <div className="rounded-2xl p-2 bg-[var(--surface-primary)] border border-[var(--border-primary)] flex flex-col sm:flex-row gap-2">
        <SkeletonBone className="h-11 flex-1 rounded-xl" />
        <SkeletonBone className="h-11 sm:w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2].map((card) => (
          <div
            key={card}
            className="rounded-2xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-2"
          >
            <SkeletonBone className="h-4 w-28 rounded" />
            <SkeletonBone className="h-3.5 w-full rounded" />
            <SkeletonBone className="h-3.5 w-4/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PdfDocumentSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Rendering PDF pages"
      className="max-w-xl mx-auto py-4"
    >
      <span className="sr-only">Rendering PDF document...</span>
      <div
        className="aspect-[1/1.41] w-full rounded-xl p-6 sm:p-8 bg-[var(--surface-primary)] border border-[var(--border-primary)] flex flex-col justify-between"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonBone className="h-4 w-28 rounded" />
            <SkeletonBone className="h-4 w-16 rounded" />
          </div>
          <SkeletonBone className="h-6 w-3/4 mx-auto rounded-md" />
          <SkeletonBone className="h-3.5 w-48 mx-auto rounded" />
        </div>
        <div className="space-y-3 my-auto py-8">
          {[1, 2, 3, 4, 5, 6].map((line) => (
            <SkeletonBone
              key={line}
              className={`h-3.5 rounded ${line % 3 === 0 ? "w-4/5" : "w-full"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
          <SkeletonBone className="h-3 w-20 rounded" />
          <SkeletonBone className="h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

export function PaperDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading question paper"
      className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 space-y-5"
    >
      <span className="sr-only">Loading question paper details...</span>
      <div className="rounded-xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <SkeletonBone className="h-5 w-16 rounded-md" />
            <SkeletonBone className="h-5 w-14 rounded-md" />
          </div>
          <SkeletonBone className="h-6 w-72 max-w-full rounded-md" />
        </div>
        <SkeletonBone className="h-10 w-44 rounded-lg" />
      </div>
      <div className="h-[72dvh] min-h-[480px] rounded-2xl p-3 bg-[var(--surface-primary)] border border-[var(--border-primary)] overflow-hidden">
        <PdfDocumentSkeleton />
      </div>
    </div>
  );
}

export function AdminSectionSkeleton({
  variant = "overview",
}: {
  variant?: "overview" | "catalog" | "queue";
}) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading admin workspace">
      <span className="sr-only">Loading admin workspace...</span>
      <div className="h-14 bg-[var(--surface-primary)] border-b border-[var(--border-primary)] px-4 md:px-6 flex items-center justify-between">
        <SkeletonBone className="h-5 w-36 rounded" />
        <div className="flex items-center gap-2">
          <SkeletonBone className="h-8 w-20 rounded-lg" />
          <SkeletonBone className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div className="max-w-7xl w-full mx-auto px-4 md:px-6 py-6 space-y-5">
        {variant === "overview" ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((kpi) => (
                <div
                  key={kpi}
                  className="rounded-xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-2"
                >
                  <SkeletonBone className="h-3.5 w-24 rounded" />
                  <SkeletonBone className="h-7 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <div className="rounded-xl p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-3">
              <SkeletonBone className="h-5 w-44 rounded" />
              {[1, 2, 3].map((row) => (
                <SkeletonBone key={row} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SkeletonBone className="h-6 w-48 rounded" />
              <SkeletonBone className="h-9 w-32 rounded-lg" />
            </div>
            {[1, 2, 3, 4].map((row) => (
              <SkeletonBone key={row} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

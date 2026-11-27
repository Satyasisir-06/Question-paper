"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "@phosphor-icons/react";

interface AnalyticsData {
  kpis: {
    pendingCount: number;
    approvedCount: number;
    totalDownloads: number;
    openReportsCount: number;
  };
  semesterCoverage: Array<{
    code: string;
    yearOfStudy: number;
    semester: number;
    regularCount: number;
    supplyCount: number;
  }>;
  coverageGaps: Array<{
    subjectId: string;
    code: string;
    name: string;
    branchCode: string;
    yearSem: string;
    missingRegular: boolean;
    missingSupply: boolean;
  }>;
  reports: Array<{
    id: string;
    paperId: string;
    reason: string;
    details: string | null;
    status: "OPEN" | "RESOLVED" | "DISMISSED";
    trackingCode: string;
    subjectCode: string;
    subjectName: string;
  }>;
}

export function AdminOverviewClient({
  initialData,
}: {
  initialData: AnalyticsData;
}) {
  const [reports, setReports] = useState(initialData.reports);
  const maxBar = Math.max(
    1,
    ...initialData.semesterCoverage.map((s) => s.regularCount + s.supplyCount)
  );

  const handleReportAction = async (
    reportId: string,
    status: "RESOLVED" | "DISMISSED"
  ) => {
    const res = await fetch(`/api/v1/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[11px] text-[var(--text-muted)]">
            ARCHIVE TELEMETRY
          </p>
          <h1 className="heading-4 text-[var(--text-primary)]">
            Archive overview
          </h1>
          <p className="body-6 text-[var(--text-secondary)]">
            Moderation workload, semester coverage, and reported papers
          </p>
        </div>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
          <Link
            href="/admin/queue?status=APPROVED"
            className="inline-flex items-center justify-center h-11 sm:h-10 px-4 rounded-xl sm:rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            Edit published papers
          </Link>
          <Link
            href="/admin/queue"
            className="inline-flex items-center justify-center h-11 sm:h-10 px-4 rounded-xl sm:rounded-lg button-sm text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)]"
          >
            Open moderation queue ({initialData.kpis.pendingCount})
          </Link>
        </div>
      </div>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {[
          {
            label: "Pending review",
            value: initialData.kpis.pendingCount,
            note: "Awaiting check",
          },
          {
            label: "Published papers",
            value: initialData.kpis.approvedCount,
            note: "Live to students",
          },
          {
            label: "Total downloads",
            value: initialData.kpis.totalDownloads,
            note: "PDFs served",
          },
          {
            label: "Open reports",
            value: reports.filter((r) => r.status === "OPEN").length,
            note: "Student flags",
          },
        ].map((card, idx) => (
          <div
            key={card.label}
            className="reveal-up rounded-2xl p-4 sm:p-5 space-y-1.5"
            style={{
              backgroundColor: "var(--surface-primary)",
              border: "1px solid var(--border-primary)",
              boxShadow: "var(--shadow-card)",
              animationDelay: `${idx * 45}ms`,
            }}
          >
            <p className="caption-4 text-[var(--text-secondary)]">{card.label}</p>
            <p className="text-2xl sm:text-3xl font-medium font-mono tabular-nums text-[var(--text-primary)]">
              {card.value}
            </p>
            <p className="caption-5 text-[var(--text-muted)]">{card.note}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        <section
          aria-label="Semester coverage chart"
          className="lg:col-span-2 rounded-2xl p-4 sm:p-5 space-y-4"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="heading-6 text-[var(--text-primary)]">
                Regular and Supply coverage by semester
              </h2>
              <p className="caption-5 text-[var(--text-muted)]">
                Approved papers available across 1-1 through 4-2
              </p>
            </div>
            <div className="flex items-center gap-4 caption-5 text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[var(--action-primary)]" />
                Regular
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#9A3412]" />
                Supply
              </span>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <div
              className="h-56 sm:h-64 min-w-[440px] sm:min-w-0 pt-6 flex items-end gap-3 px-2"
              style={{
                borderBottom: "1px solid var(--border-primary)",
                backgroundImage:
                  "linear-gradient(to top, var(--border-primary) 1px, transparent 1px)",
                backgroundSize: "100% 25%",
              }}
            >
              {initialData.semesterCoverage.map((row) => {
                const total = row.regularCount + row.supplyCount;
                const regPct = Math.round((row.regularCount / maxBar) * 100);
                const supPct = Math.round((row.supplyCount / maxBar) * 100);
                return (
                  <div
                    key={row.code}
                    className="flex-1 h-full flex flex-col items-center justify-end gap-2"
                  >
                    <span className="font-mono caption-5 text-[var(--text-muted)] tabular-nums">
                      {total}
                    </span>
                    <div className="w-full max-w-10 flex items-end justify-center gap-1 h-36 sm:h-44">
                      <div
                        title={`${row.code} Regular: ${row.regularCount}`}
                        className="flex-1 rounded-t bg-[var(--action-primary)]"
                        style={{ height: `${Math.max(regPct, row.regularCount > 0 ? 8 : 0)}%` }}
                      />
                      <div
                        title={`${row.code} Supply: ${row.supplyCount}`}
                        className="flex-1 rounded-t bg-[#9A3412]"
                        style={{ height: `${Math.max(supPct, row.supplyCount > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                    <span className="font-mono caption-4 text-[var(--text-secondary)] pb-2">
                      {row.code}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          aria-label="Coverage gaps"
          className="rounded-2xl p-4 sm:p-5 space-y-3"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="heading-6 text-[var(--text-primary)]">
            Missing exam sets
          </h2>
          <p className="caption-5 text-[var(--text-muted)]">
            Subjects missing Regular or Supply papers
          </p>

          <div className="divide-y divide-[var(--border-primary)]">
            {initialData.coverageGaps.map((gap) => (
              <div
                key={gap.subjectId}
                className="py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-mono caption-4 text-[var(--text-primary)]">
                    {gap.code} · {gap.branchCode} · {gap.yearSem}
                  </p>
                  <p className="caption-5 text-[var(--text-secondary)] truncate">
                    {gap.name}
                  </p>
                </div>
                <span className="caption-5 font-mono text-[var(--badge-supply-text)] shrink-0">
                  {gap.missingRegular && gap.missingSupply
                    ? "No papers"
                    : gap.missingSupply
                      ? "No Supply"
                      : "No Regular"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section
        aria-label="Student reports"
        className="rounded-2xl p-4 sm:p-5 space-y-3"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2 className="heading-6 text-[var(--text-primary)]">
          Reported paper issues
        </h2>
        {reports.length === 0 ? (
          <p className="body-6 text-[var(--text-muted)]">
            No issues reported by students.
          </p>
        ) : (
          <>
            <div className="md:hidden space-y-2.5">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-xl p-3.5 bg-[var(--surface-raised)]/70 border border-[var(--border-primary)] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono caption-4 text-[var(--text-primary)]">
                        {rep.subjectCode}
                      </span>
                      <p className="body-6 text-[var(--text-primary)] truncate">
                        {rep.subjectName}
                      </p>
                    </div>
                    <span className="font-mono caption-5 px-2 py-0.5 rounded bg-[var(--surface-primary)] border border-[var(--border-primary)] shrink-0">
                      {rep.status}
                    </span>
                  </div>
                  <p className="caption-5 text-[var(--text-secondary)]">
                    {rep.reason}
                    {rep.details ? ` — ${rep.details}` : ""}
                  </p>
                  {rep.status === "OPEN" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleReportAction(rep.id, "RESOLVED")}
                        className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] caption-4 text-[var(--text-primary)] cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Resolve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReportAction(rep.id, "DISMISSED")}
                        className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] caption-4 text-[var(--text-secondary)] cursor-pointer"
                      >
                        <X size={14} />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] caption-4 text-[var(--text-muted)]">
                    <th className="py-2 pr-4">Paper</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {reports.map((rep) => (
                    <tr key={rep.id} className="body-6">
                      <td className="py-2.5 pr-4">
                        <span className="font-mono caption-4">{rep.subjectCode}</span>{" "}
                        {rep.subjectName}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)]">
                        {rep.reason}
                        {rep.details ? ` — ${rep.details}` : ""}
                      </td>
                      <td className="py-2.5 pr-4 font-mono caption-4">{rep.status}</td>
                      <td className="py-2.5 text-right space-x-2">
                        {rep.status === "OPEN" && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleReportAction(rep.id, "RESOLVED")}
                              className="inline-flex items-center gap-1 h-7 px-2 rounded bg-[var(--surface-raised)] caption-4 cursor-pointer"
                            >
                              <Check size={14} />
                              <span>Resolve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReportAction(rep.id, "DISMISSED")}
                              className="inline-flex items-center gap-1 h-7 px-2 rounded bg-[var(--surface-raised)] caption-4 cursor-pointer"
                            >
                              <X size={14} />
                              <span>Dismiss</span>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

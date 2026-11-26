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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-4 text-[var(--text-primary)]">
            Archive overview
          </h1>
          <p className="body-6 text-[var(--text-secondary)]">
            Moderation workload, semester coverage, and reported papers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/queue?status=APPROVED"
            className="inline-flex items-center h-10 px-4 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            Edit published papers
          </Link>
          <Link
            href="/admin/queue"
            className="inline-flex items-center h-10 px-4 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            Open moderation queue ({initialData.kpis.pendingCount})
          </Link>
        </div>
      </div>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: "Pending review",
            value: initialData.kpis.pendingCount,
            note: "Awaiting admin check",
          },
          {
            label: "Published papers",
            value: initialData.kpis.approvedCount,
            note: "Visible to students",
          },
          {
            label: "Total downloads",
            value: initialData.kpis.totalDownloads,
            note: "Across approved papers",
          },
          {
            label: "Open reports",
            value: reports.filter((r) => r.status === "OPEN").length,
            note: "Flagged by students",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5 space-y-2"
            style={{
              backgroundColor: "var(--surface-primary)",
              border: "1px solid var(--border-primary)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <p className="caption-4 text-[var(--text-secondary)]">{card.label}</p>
            <p className="text-3xl font-medium font-mono tabular-nums text-[var(--text-primary)]">
              {card.value}
            </p>
            <p className="caption-5 text-[var(--text-muted)]">{card.note}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section
          aria-label="Semester coverage chart"
          className="lg:col-span-2 rounded-xl p-5 space-y-4"
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
                <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB]" />
                Regular
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#C2410C]" />
                Supply
              </span>
            </div>
          </div>

          <div
            className="h-64 pt-6 flex items-end gap-3 px-2"
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
                  <div className="w-full max-w-10 flex items-end justify-center gap-1 h-44">
                    <div
                      title={`${row.code} Regular: ${row.regularCount}`}
                      className="flex-1 rounded-t bg-[#2563EB]"
                      style={{ height: `${Math.max(regPct, row.regularCount > 0 ? 8 : 0)}%` }}
                    />
                    <div
                      title={`${row.code} Supply: ${row.supplyCount}`}
                      className="flex-1 rounded-t bg-[#C2410C]"
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
        </section>

        <section
          aria-label="Coverage gaps"
          className="rounded-xl p-5 space-y-3"
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
        className="rounded-xl p-5 space-y-3"
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
          <div className="overflow-x-auto">
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
        )}
      </section>
    </div>
  );
}

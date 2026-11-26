"use client";

import { useState } from "react";
import { Plus, UploadSimple } from "@phosphor-icons/react";
import type { FilterCatalogDto } from "@/types/paper";
import { getSemestersForYear, type ExamTypeValue } from "@/lib/btech";
import { safeReadApiJson } from "@/lib/httpClient";

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  createdAt: string;
}

export function CatalogManagerClient({
  initialCatalog,
  initialAuditLogs,
}: {
  initialCatalog: FilterCatalogDto;
  initialAuditLogs: AuditLogRow[];
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Branch form
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");

  // CSV Subject import
  const [csvText, setCsvText] = useState(
    "code,name,branchCode,regulationCode,yearOfStudy,semester\nCS405,Software Engineering,CSE,R22,2,4"
  );

  // Direct Admin Publish
  const [pubFile, setPubFile] = useState<File | null>(null);
  const [pubYear, setPubYear] = useState(2);
  const [pubSem, setPubSem] = useState(4);
  const [pubBranchId, setPubBranchId] = useState(
    initialCatalog.branches[0]?.id ?? ""
  );
  const [pubRegId, setPubRegId] = useState(
    initialCatalog.regulations[0]?.id ?? ""
  );
  const [pubSubjectId, setPubSubjectId] = useState(
    initialCatalog.subjects[0]?.id ?? ""
  );
  const [pubExamType, setPubExamType] = useState<ExamTypeValue>("REGULAR");
  const [pubMonth, setPubMonth] = useState(11);
  const [pubExamYear, setPubExamYear] = useState(2025);

  const refreshCatalog = async () => {
    const res = await fetch("/api/v1/admin/catalog");
    const parsed = await safeReadApiJson<FilterCatalogDto>(
      res,
      "Unable to refresh catalog."
    );
    if (parsed.ok && parsed.data) {
      setCatalog(parsed.data);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");
    const res = await fetch("/api/v1/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "branch",
        data: { code: branchCode, name: branchName },
      }),
    });
    const parsed = await safeReadApiJson<{ code: string }>(
      res,
      "Unable to create branch."
    );
    if (!parsed.ok || !parsed.data) {
      setErrorMsg(parsed.errorMessage);
      return;
    }
    setBranchCode("");
    setBranchName("");
    setStatusMsg(`Branch ${parsed.data.code} added`);
    await refreshCatalog();
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");
    const res = await fetch("/api/v1/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "csv_subjects",
        data: { csv: csvText },
      }),
    });
    const parsed = await safeReadApiJson<{ inserted: number; skipped: unknown[] }>(
      res,
      "CSV import failed."
    );
    if (!parsed.ok || !parsed.data) {
      setErrorMsg(parsed.errorMessage);
      return;
    }
    setStatusMsg(
      `Imported ${parsed.data.inserted} subjects (${parsed.data.skipped.length} skipped)`
    );
    await refreshCatalog();
  };

  const handleDirectPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");
    if (!pubFile) {
      setErrorMsg("Select a PDF file first.");
      return;
    }

    const fd = new FormData();
    fd.set("file", pubFile);
    fd.set("branchId", pubBranchId);
    fd.set("regulationId", pubRegId);
    fd.set("subjectId", pubSubjectId);
    fd.set("yearOfStudy", String(pubYear));
    fd.set("semester", String(pubSem));
    fd.set("examType", pubExamType);
    fd.set("examMonth", String(pubMonth));
    fd.set("examYear", String(pubExamYear));

    const res = await fetch("/api/v1/admin/papers/bulk-upload", {
      method: "POST",
      body: fd,
    });
    const parsed = await safeReadApiJson<{ trackingCode: string }>(
      res,
      "Direct publish failed."
    );
    if (!parsed.ok || !parsed.data) {
      setErrorMsg(parsed.errorMessage);
      return;
    }
    setPubFile(null);
    setStatusMsg(`Published ${parsed.data.trackingCode} directly to archive`);
  };

  const validSems = getSemestersForYear(pubYear);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-4 text-[var(--text-primary)]">
          Catalog and direct publish
        </h1>
        <p className="body-6 text-[var(--text-secondary)]">
          Manage branches, bulk import subjects via CSV, or publish official exam
          cell PDFs directly
        </p>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="rounded-xl px-4 py-3 body-6"
          style={{
            backgroundColor: "var(--badge-regular-bg)",
            color: "var(--badge-regular-text)",
            border: "1px solid var(--badge-regular-border)",
          }}
        >
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 body-6"
          style={{
            backgroundColor: "var(--badge-rejected-bg)",
            color: "var(--badge-rejected-text)",
            border: "1px solid var(--badge-rejected-border)",
          }}
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleDirectPublish}
          className="rounded-xl p-5 space-y-4"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <h2 className="heading-6 text-[var(--text-primary)]">
            Direct admin upload (skip queue)
          </h2>

          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setPubFile(e.target.files?.[0] ?? null)}
            className="w-full body-6 text-[var(--text-secondary)]"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={pubYear}
              onChange={(e) => {
                const y = Number(e.target.value);
                setPubYear(y);
                setPubSem(getSemestersForYear(y)[0]);
              }}
              className="h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
            <select
              value={pubSem}
              onChange={(e) => setPubSem(Number(e.target.value))}
              className="h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {validSems.map((s) => (
                <option key={s} value={s}>
                  Sem {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={pubBranchId}
              onChange={(e) => setPubBranchId(e.target.value)}
              className="h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {catalog.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
            <select
              value={pubRegId}
              onChange={(e) => setPubRegId(e.target.value)}
              className="h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {catalog.regulations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>
          </div>

          <select
            value={pubSubjectId}
            onChange={(e) => setPubSubjectId(e.target.value)}
            className="w-full h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {catalog.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2">
            <select
              value={pubExamType}
              onChange={(e) => setPubExamType(e.target.value as ExamTypeValue)}
              className="h-9 px-2 rounded-lg body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              <option value="REGULAR">Regular</option>
              <option value="SUPPLY">Supply</option>
              <option value="MID_1">Midterm 1</option>
              <option value="MID_2">Midterm 2</option>
            </select>
            <input
              type="number"
              min={1}
              max={12}
              value={pubMonth}
              onChange={(e) => setPubMonth(Number(e.target.value))}
              className="h-9 px-2.5 rounded-lg font-mono body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
            <input
              type="number"
              min={2010}
              max={2035}
              value={pubExamYear}
              onChange={(e) => setPubExamYear(Number(e.target.value))}
              className="h-9 px-2.5 rounded-lg font-mono body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] cursor-pointer"
          >
            <UploadSimple size={16} />
            <span>Publish immediately</span>
          </button>
        </form>

        <div className="space-y-6">
          <form
            onSubmit={handleAddBranch}
            className="rounded-xl p-5 space-y-3"
            style={{
              backgroundColor: "var(--surface-primary)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <h2 className="heading-6 text-[var(--text-primary)]">Add branch</h2>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                placeholder="CSDS"
                className="h-9 px-2.5 rounded-lg font-mono body-6 bg-[var(--surface-raised)]"
                style={{ border: "1px solid var(--border-primary)" }}
              />
              <input
                type="text"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Data Science"
                className="col-span-2 h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-raised)]"
                style={{ border: "1px solid var(--border-primary)" }}
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg button-sm bg-[var(--surface-raised)] text-[var(--text-primary)] cursor-pointer"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              <Plus size={15} />
              <span>Add branch</span>
            </button>
          </form>

          <form
            onSubmit={handleCsvImport}
            className="rounded-xl p-5 space-y-3"
            style={{
              backgroundColor: "var(--surface-primary)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <h2 className="heading-6 text-[var(--text-primary)]">
              Bulk import subjects (CSV)
            </h2>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-2.5 rounded-lg font-mono caption-5 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] cursor-pointer"
            >
              <span>Import subjects</span>
            </button>
          </form>
        </div>
      </div>

      <section
        aria-label="Recent audit logs"
        className="rounded-xl p-5 space-y-3"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h2 className="heading-6 text-[var(--text-primary)]">
          Moderation audit log
        </h2>
        {initialAuditLogs.length === 0 ? (
          <p className="body-6 text-[var(--text-muted)]">No admin actions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-primary)] caption-4 text-[var(--text-muted)]">
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)] font-mono caption-5">
                {initialAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">
                      {log.action}
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-secondary)]">
                      {log.entityType} ({log.entityId.slice(0, 8)})
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {log.ipAddress ?? "-"}
                    </td>
                    <td className="py-2 text-[var(--text-muted)]">
                      {new Date(log.createdAt).toLocaleString()}
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

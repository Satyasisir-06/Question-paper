"use client";

import { useState } from "react";
import { Check, MagnifyingGlass, Plus, UploadSimple } from "@phosphor-icons/react";
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

  // Subject inline rename
  const [subjectQuery, setSubjectQuery] = useState("");
  const [subjectDrafts, setSubjectDrafts] = useState<
    Record<string, { code: string; name: string }>
  >({});
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null);

  const handleSaveSubject = async (subject: FilterCatalogDto["subjects"][number]) => {
    const draft = subjectDrafts[subject.id] ?? {
      code: subject.code,
      name: subject.name,
    };
    const cleanCode = draft.code.trim().toUpperCase();
    const cleanName = draft.name.trim();
    if (cleanCode.length < 2 || cleanName.length < 2) {
      setErrorMsg("Enter both a valid subject code and subject name.");
      return;
    }

    setSavingSubjectId(subject.id);
    setStatusMsg("");
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/admin/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subject.id,
          code: cleanCode,
          name: cleanName,
        }),
      });
      const parsed = await safeReadApiJson<{ code: string; name: string }>(
        res,
        "Unable to update subject."
      );
      if (!parsed.ok || !parsed.data) {
        setErrorMsg(parsed.errorMessage);
        return;
      }
      setStatusMsg(
        `Updated subject ${parsed.data.code} — ${parsed.data.name} across all linked papers`
      );
      await refreshCatalog();
    } finally {
      setSavingSubjectId(null);
    }
  };

  const validSems = getSemestersForYear(pubYear);
  const branchNameById = new Map(catalog.branches.map((b) => [b.id, b.code]));
  const regNameById = new Map(catalog.regulations.map((r) => [r.id, r.code]));
  const trimmedSubjectQuery = subjectQuery.trim().toLowerCase();
  const filteredSubjects = trimmedSubjectQuery
    ? catalog.subjects.filter(
        (s) =>
          s.code.toLowerCase().includes(trimmedSubjectQuery) ||
          s.name.toLowerCase().includes(trimmedSubjectQuery)
      )
    : catalog.subjects;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] text-[var(--text-muted)]">
          CURRICULUM &amp; DIRECT PUBLISH
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <form
          onSubmit={handleDirectPublish}
          className="rounded-2xl p-4 sm:p-5 space-y-4"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="heading-6 text-[var(--text-primary)]">
            Direct admin upload (skip queue)
          </h2>

          <label
            className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 bg-[var(--surface-raised)] cursor-pointer hover:opacity-90 transition-opacity"
            style={{ border: "1.5px dashed var(--border-strong)" }}
          >
            <div className="min-w-0">
              <span className="block caption-4 text-[var(--text-primary)] truncate">
                {pubFile ? pubFile.name : "Choose official exam PDF"}
              </span>
              <span className="block caption-5 text-[var(--text-muted)]">
                {pubFile
                  ? `${Math.max(1, Math.round(pubFile.size / 1024))} KB PDF selected`
                  : "Tap to browse a verified PDF file"}
              </span>
            </div>
            <span
              className="shrink-0 h-9 px-3 rounded-lg inline-flex items-center caption-4 bg-[var(--surface-primary)] text-[var(--text-primary)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              Browse
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setPubFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>

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
        aria-label="Edit catalog subject names"
        className="rounded-xl p-5 space-y-4"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="heading-6 text-[var(--text-primary)]">
              Subjects directory (edit names after publish)
            </h2>
            <p className="caption-5 text-[var(--text-muted)]">
              Renaming a subject updates every published paper linked to it across the archive.
            </p>
          </div>
          <div className="relative sm:w-72">
            <MagnifyingGlass
              size={15}
              weight="regular"
              className="absolute left-3 top-2.5 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              type="search"
              value={subjectQuery}
              onChange={(e) => setSubjectQuery(e.target.value)}
              placeholder="Search code or subject name"
              aria-label="Search catalog subjects"
              className="w-full h-9 pl-8 pr-3 rounded-lg body-6 bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-primary)]">
          {filteredSubjects.map((subject) => {
            const draft = subjectDrafts[subject.id] ?? {
              code: subject.code,
              name: subject.name,
            };
            const dirty =
              draft.code.trim().toUpperCase() !== subject.code ||
              draft.name.trim() !== subject.name;
            const busy = savingSubjectId === subject.id;
            const branchCode = branchNameById.get(subject.branchId) ?? "";
            const regCode = regNameById.get(subject.regulationId) ?? "";

            return (
              <div
                key={subject.id}
                className="py-3 flex flex-col md:flex-row md:items-center gap-2.5"
              >
                <div className="flex items-center justify-between md:justify-start gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="text"
                      value={draft.code}
                      aria-label={`Subject code for ${subject.code}`}
                      onChange={(e) =>
                        setSubjectDrafts((prev) => ({
                          ...prev,
                          [subject.id]: {
                            ...draft,
                            code: e.target.value.toUpperCase(),
                          },
                        }))
                      }
                      className="w-24 h-10 md:h-9 px-2.5 rounded-xl md:rounded-lg font-mono caption-4 bg-[var(--surface-raised)] shrink-0"
                      style={{ border: "1px solid var(--border-primary)" }}
                    />
                    <span className="font-mono caption-5 text-[var(--text-muted)] truncate md:w-28 shrink-0">
                      {subject.yearOfStudy}-{subject.semester % 2 === 1 ? 1 : 2} ·{" "}
                      {branchCode} {regCode}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!dirty || busy}
                    onClick={() => void handleSaveSubject(subject)}
                    className={`md:hidden inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg caption-4 shrink-0 cursor-pointer transition-colors ${
                      dirty
                        ? "text-white bg-[var(--action-primary)]"
                        : "text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border-primary)]"
                    }`}
                  >
                    <Check size={14} weight="bold" />
                    <span>{busy ? "Saving..." : "Save"}</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={draft.name}
                  aria-label={`Subject name for ${subject.code}`}
                  onChange={(e) =>
                    setSubjectDrafts((prev) => ({
                      ...prev,
                      [subject.id]: {
                        ...draft,
                        name: e.target.value,
                      },
                    }))
                  }
                  className="w-full md:flex-1 h-10 md:h-9 px-3 rounded-xl md:rounded-lg text-base md:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
                  style={{ border: "1px solid var(--border-primary)" }}
                />

                <button
                  type="button"
                  disabled={!dirty || busy}
                  onClick={() => void handleSaveSubject(subject)}
                  className={`hidden md:inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg button-sm shrink-0 cursor-pointer transition-colors ${
                    dirty
                      ? "text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)]"
                      : "text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border-primary)]"
                  }`}
                >
                  <Check size={14} weight="bold" />
                  <span>{busy ? "Saving..." : "Save"}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Recent audit logs"
        className="rounded-2xl p-4 sm:p-5 space-y-3"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2 className="heading-6 text-[var(--text-primary)]">
          Moderation audit log
        </h2>
        {initialAuditLogs.length === 0 ? (
          <p className="body-6 text-[var(--text-muted)]">No admin actions recorded yet.</p>
        ) : (
          <>
            <div className="md:hidden divide-y divide-[var(--border-primary)]">
              {initialAuditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5 font-mono">
                    <p className="caption-4 text-[var(--text-primary)] truncate">
                      {log.action}
                    </p>
                    <p className="caption-5 text-[var(--text-secondary)] truncate">
                      {log.entityType} ({log.entityId.slice(0, 8)}) · {log.ipAddress ?? "-"}
                    </p>
                  </div>
                  <span
                    className="font-mono caption-5 text-[var(--text-muted)] shrink-0 text-right"
                    suppressHydrationWarning
                  >
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
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
                      <td className="py-2 text-[var(--text-muted)]" suppressHydrationWarning>
                        {new Date(log.createdAt).toLocaleString()}
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

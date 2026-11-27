"use client";

import { useState } from "react";
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  MagicWand,
  MagnifyingGlass,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { FilterCatalogDto } from "@/types/paper";
import {
  formatFileSize,
  getSemestersForYear,
  type ExamTypeValue,
  type PaperStatusValue,
} from "@/lib/btech";
import { ExamTypeBadge, StatusBadge } from "@/components/ui/ExamBadge";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { PaperCardListSkeleton } from "@/components/ui/Skeletons";
import { scanPaperFileInBrowser } from "@/lib/browserPaperTools";
import { safeReadApiJson } from "@/lib/httpClient";

export interface AdminQueueItemDto {
  id: string;
  trackingCode: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  branchId: string;
  branchCode: string;
  regulationId: string;
  regulationCode: string;
  yearOfStudy: number;
  semester: number;
  examType: ExamTypeValue;
  examMonth: number;
  examYear: number;
  setLabel: string | null;
  fileSizeBytes: number;
  pageCount: number;
  status: PaperStatusValue;
  uploaderName: string | null;
  uploaderEmail: string | null;
  rejectionReason: string | null;
  duplicateMatches: Array<{
    id: string;
    trackingCode: string;
    status: PaperStatusValue;
  }>;
}

const PRESET_REASONS = [
  "Blurry or unreadable scan",
  "Duplicate of an already published question paper",
  "Incorrect subject, semester, or syllabus regulation",
  "Missing pages or not a valid question paper",
] as const;

function QueueInspector({
  activeItem,
  catalog,
  statusTab,
  onDone,
  onFeedback,
}: {
  activeItem: AdminQueueItemDto;
  catalog: FilterCatalogDto;
  statusTab: PaperStatusValue;
  onDone: () => Promise<void>;
  onFeedback: (msg: string) => void;
}) {
  const [actionBusy, setActionBusy] = useState(false);
  const [editBranchId, setEditBranchId] = useState(activeItem.branchId);
  const [editRegulationId, setEditRegulationId] = useState(
    activeItem.regulationId
  );
  const [editYear, setEditYear] = useState(activeItem.yearOfStudy);
  const [editSem, setEditSem] = useState(activeItem.semester);
  const [editSubjectId, setEditSubjectId] = useState(activeItem.subjectId);
  const [editSubjectCode, setEditSubjectCode] = useState(activeItem.subjectCode);
  const [editSubjectName, setEditSubjectName] = useState(activeItem.subjectName);
  const [editExamType, setEditExamType] = useState<ExamTypeValue>(
    activeItem.examType
  );
  const [editExamMonth, setEditExamMonth] = useState(activeItem.examMonth);
  const [editExamYear, setEditExamYear] = useState(activeItem.examYear);
  const [editSetLabel, setEditSetLabel] = useState(activeItem.setLabel ?? "");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>(PRESET_REASONS[0]);
  const [mobilePane, setMobilePane] = useState<"split" | "meta" | "pdf">("split");
  const [scanningPdf, setScanningPdf] = useState(false);
  const [scanSummary, setScanSummary] = useState("");

  const validSems = getSemestersForYear(editYear);
  const matchingSubjects = catalog.subjects.filter(
    (s) =>
      s.yearOfStudy === editYear &&
      s.semester === editSem &&
      (s.branchId === editBranchId || s.isCommonFirstYear)
  );

  const handleAutoScan = async () => {
    setScanningPdf(true);
    setScanSummary("Scanning PDF header...");
    try {
      const res = await fetch(`/api/v1/admin/papers/${activeItem.id}/preview`);
      if (!res.ok) {
        setScanSummary("Unable to load PDF bytes for scanning.");
        return;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const outcome = await scanPaperFileInBrowser({
        pdfBytes: bytes,
        catalog,
        onProgress: setScanSummary,
      });
      const m = outcome.metadata;
      if (m.yearOfStudy && m.semester) {
        setEditYear(m.yearOfStudy);
        setEditSem(m.semester);
      }
      if (m.branchId) setEditBranchId(m.branchId);
      if (m.regulationId) setEditRegulationId(m.regulationId);
      if (m.subjectId) {
        setEditSubjectId(m.subjectId);
        const found = catalog.subjects.find((s) => s.id === m.subjectId);
        if (found) {
          setEditSubjectCode(found.code);
          setEditSubjectName(found.name);
        }
      } else {
        if (m.subjectCode) setEditSubjectCode(m.subjectCode);
        if (m.subjectName) setEditSubjectName(m.subjectName);
      }
      if (m.examType) setEditExamType(m.examType);
      if (m.examMonth) setEditExamMonth(m.examMonth);
      if (m.examYear) setEditExamYear(m.examYear);

      const titleText = [m.subjectCode, m.subjectName]
        .filter(Boolean)
        .join(" — ");
      if (m.detectedFields.length > 0) {
        setScanSummary(
          `Detected (${outcome.method === "pdf_text" ? "PDF text" : "OCR"}): ${
            titleText || m.detectedFields.join(", ")
          }`
        );
      } else {
        setScanSummary("No readable header text detected in this PDF.");
      }
    } catch {
      setScanSummary("Auto-scan failed for this PDF.");
    } finally {
      setScanningPdf(false);
    }
  };

  const handleApprove = async () => {
    const cleanCode = editSubjectCode.trim().toUpperCase();
    const cleanName = editSubjectName.trim();
    if (cleanCode.length < 2 || cleanName.length < 2) {
      onFeedback("Enter both a valid subject code and subject name.");
      return;
    }

    setActionBusy(true);
    onFeedback("");
    try {
      const res = await fetch(`/api/v1/admin/papers/${activeItem.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: editBranchId,
          regulationId: editRegulationId,
          subjectId: editSubjectId,
          subjectCode: cleanCode,
          subjectName: cleanName,
          yearOfStudy: editYear,
          semester: editSem,
          examType: editExamType,
          examMonth: editExamMonth,
          examYear: editExamYear,
          setLabel: editSetLabel.trim() || null,
        }),
      });
      const parsed = await safeReadApiJson(res, "Unable to save paper changes.");
      if (!parsed.ok) {
        onFeedback(parsed.errorMessage);
        return;
      }
      onFeedback(
        statusTab === "APPROVED"
          ? `Updated published paper ${activeItem.trackingCode} (${cleanCode} — ${cleanName})`
          : `Paper ${activeItem.trackingCode} approved and published`
      );
      await onDone();
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBusy(true);
    onFeedback("");
    try {
      const res = await fetch(`/api/v1/admin/papers/${activeItem.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const parsed = await safeReadApiJson(res, "Unable to reject submission.");
      if (!parsed.ok) {
        onFeedback(parsed.errorMessage);
        return;
      }
      setRejectOpen(false);
      onFeedback(`Submission ${activeItem.trackingCode} rejected`);
      await onDone();
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start">
      <div
        role="group"
        aria-label="Mobile workspace view"
        className="lg:hidden grid grid-cols-3 p-1 rounded-xl bg-[var(--surface-raised)]"
        style={{ border: "1px solid var(--border-primary)" }}
      >
        {(
          [
            { id: "split", label: "Split view" },
            { id: "meta", label: "Edit details" },
            { id: "pdf", label: "Full PDF" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePane(tab.id)}
            className={`tap-press h-9 rounded-lg caption-4 cursor-pointer ${
              mobilePane === tab.id
                ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`${
          mobilePane === "meta" ? "hidden lg:flex" : "flex"
        } lg:col-span-8 rounded-2xl p-3 flex-col gap-2 ${
          mobilePane === "pdf"
            ? "h-[68dvh] min-h-[440px]"
            : "h-[38dvh] min-h-[260px] lg:h-[80vh] lg:min-h-[480px]"
        }`}
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono caption-4 text-[var(--text-primary)]">
              {activeItem.trackingCode}
            </span>
            <span className="font-mono caption-5 text-[var(--text-muted)]">
              {formatFileSize(activeItem.fileSizeBytes)} · {activeItem.pageCount}{" "}
              pages
            </span>
          </div>
          <StatusBadge status={activeItem.status} />
        </div>

        <div className="flex-1 min-h-0">
          <PdfViewer
            src={`/api/v1/admin/papers/${activeItem.id}/preview`}
            title={`${activeItem.subjectCode} ${activeItem.trackingCode}`}
          />
        </div>
      </div>

      <div
        className={`${
          mobilePane === "pdf" ? "hidden lg:block" : "block"
        } lg:col-span-4 rounded-2xl p-4 sm:p-5 space-y-4`}
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="heading-6 text-[var(--text-primary)]">
            {statusTab === "APPROVED"
              ? "Edit published paper"
              : "Verify paper metadata"}
          </h2>
          <button
            type="button"
            disabled={scanningPdf}
            onClick={() => void handleAutoScan()}
            className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 sm:px-2.5 rounded-xl sm:rounded-lg caption-4 text-[var(--action-primary)] bg-[var(--surface-raised)] hover:opacity-90 disabled:opacity-60 cursor-pointer"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <MagicWand size={14} weight="regular" />
            <span>{scanningPdf ? "Scanning..." : "Auto-scan PDF"}</span>
          </button>
        </div>

        {scanSummary && (
          <div
            role="status"
            className="rounded-lg p-2.5 caption-4 bg-[var(--surface-raised)] text-[var(--text-secondary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {scanSummary}
          </div>
        )}

        {activeItem.duplicateMatches.length > 0 && (
          <div
            role="alert"
            className="rounded-lg p-3 flex items-start gap-2"
            style={{
              backgroundColor: "var(--badge-pending-bg)",
              color: "var(--badge-pending-text)",
              border: "1px solid var(--badge-pending-border)",
            }}
          >
            <WarningCircle size={18} className="shrink-0 mt-0.5" />
            <div className="caption-4">
              Exact PDF SHA-256 matches existing submission:{" "}
              <span className="font-mono">
                {activeItem.duplicateMatches
                  .map((d) => `${d.trackingCode} (${d.status})`)
                  .join(", ")}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block caption-4 text-[var(--text-muted)] mb-1">
              Year
            </label>
            <select
              value={editYear}
              onChange={(e) => {
                const y = Number(e.target.value);
                setEditYear(y);
                setEditSem(getSemestersForYear(y)[0]);
              }}
              className="w-full h-10 px-2.5 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block caption-4 text-[var(--text-muted)] mb-1">
              Semester
            </label>
            <select
              value={editSem}
              onChange={(e) => setEditSem(Number(e.target.value))}
              className="w-full h-10 px-2.5 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {validSems.map((s) => (
                <option key={s} value={s}>
                  Sem {s} ({editYear}-{s % 2 === 1 ? 1 : 2})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block caption-4 text-[var(--text-muted)] mb-1">
              Branch
            </label>
            <select
              value={editBranchId}
              onChange={(e) => setEditBranchId(e.target.value)}
              className="w-full h-10 px-2.5 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {catalog.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block caption-4 text-[var(--text-muted)] mb-1">
              Regulation
            </label>
            <select
              value={editRegulationId}
              onChange={(e) => setEditRegulationId(e.target.value)}
              className="w-full h-10 px-2.5 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {catalog.regulations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="mod-subject-select"
            className="block caption-4 text-[var(--text-muted)] mb-1"
          >
            Catalog subject
          </label>
          <select
            id="mod-subject-select"
            value={editSubjectId}
            onChange={(e) => {
              const nextId = e.target.value;
              setEditSubjectId(nextId);
              const match = catalog.subjects.find((s) => s.id === nextId);
              if (match) {
                setEditSubjectCode(match.code);
                setEditSubjectName(match.name);
              }
            }}
            className="w-full h-10 px-2.5 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {(matchingSubjects.length > 0
              ? matchingSubjects
              : catalog.subjects
            ).map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label
              htmlFor="mod-subject-code"
              className="block caption-4 text-[var(--text-muted)] mb-1"
            >
              Subject code
            </label>
            <input
              id="mod-subject-code"
              type="text"
              value={editSubjectCode}
              onChange={(e) => setEditSubjectCode(e.target.value.toUpperCase())}
              className="w-full h-10 px-2.5 rounded-lg font-mono text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="mod-subject-name"
              className="block caption-4 text-[var(--text-muted)] mb-1"
            >
              Subject name
            </label>
            <input
              id="mod-subject-name"
              type="text"
              value={editSubjectName}
              onChange={(e) => setEditSubjectName(e.target.value)}
              placeholder="Enter subject name"
              className="w-full h-10 px-2.5 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>
        </div>
        <p className="caption-5 text-[var(--text-muted)]">
          Edit the subject name directly after publish, or change the code to assign a separate subject.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block caption-4 text-[var(--text-muted)] mb-1">
              Exam type
            </label>
            <select
              value={editExamType}
              onChange={(e) =>
                setEditExamType(e.target.value as ExamTypeValue)
              }
              className="w-full h-10 px-2 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              <option value="REGULAR">Regular</option>
              <option value="SUPPLY">Supply</option>
              <option value="MID_1">Midterm 1</option>
              <option value="MID_2">Midterm 2</option>
            </select>
          </div>
          <div>
            <label className="block caption-4 text-[var(--text-muted)] mb-1">
              Month
            </label>
            <input
              type="number"
              min={1}
              max={12}
              value={editExamMonth}
              onChange={(e) => setEditExamMonth(Number(e.target.value))}
              className="w-full h-10 px-2.5 rounded-lg font-mono text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>
          <div>
            <label className="block caption-4 text-[var(--text-muted)] mb-1">
              Year
            </label>
            <input
              type="number"
              min={2010}
              max={2035}
              value={editExamYear}
              onChange={(e) => setEditExamYear(Number(e.target.value))}
              className="w-full h-10 px-2.5 rounded-lg font-mono text-base sm:text-sm bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>
        </div>

        <div>
          <label className="block caption-4 text-[var(--text-muted)] mb-1">
            Set label
          </label>
          <input
            type="text"
            value={editSetLabel}
            onChange={(e) => setEditSetLabel(e.target.value)}
            placeholder="Optional (Set A)"
            className="w-full h-10 px-2.5 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          />
        </div>

        <p className="caption-5 text-[var(--text-muted)]">
          Uploaded by: {activeItem.uploaderName || "Anonymous"}{" "}
          {activeItem.uploaderEmail ? `(${activeItem.uploaderEmail})` : ""}
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={
              actionBusy ||
              editSubjectCode.trim().length < 2 ||
              editSubjectName.trim().length < 2
            }
            onClick={() => void handleApprove()}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 rounded-lg button-sm text-white bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <CheckCircle size={17} weight="regular" />
            <span>
              {actionBusy
                ? "Saving..."
                : statusTab === "APPROVED"
                  ? "Save changes"
                  : "Approve and publish"}
            </span>
          </button>

          {statusTab !== "REJECTED" && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setRejectOpen((prev) => !prev)}
              className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-3 rounded-lg button-sm bg-[var(--badge-rejected-bg)] text-[var(--badge-rejected-text)] cursor-pointer"
              style={{ border: "1px solid var(--badge-rejected-border)" }}
            >
              <XCircle size={17} weight="regular" />
              <span>Reject</span>
            </button>
          )}
        </div>

        {rejectOpen && (
          <form
            onSubmit={handleReject}
            className="rounded-lg p-3 space-y-2.5 bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <label className="block caption-4 text-[var(--text-primary)]">
              Rejection reason
            </label>
            <select
              value={
                PRESET_REASONS.includes(
                  rejectReason as (typeof PRESET_REASONS)[number]
                )
                  ? rejectReason
                  : "custom"
              }
              onChange={(e) => {
                if (e.target.value !== "custom") {
                  setRejectReason(e.target.value);
                }
              }}
              className="w-full h-10 sm:h-9 px-2.5 rounded-lg body-6 bg-[var(--surface-primary)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {PRESET_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="custom">Custom reason</option>
            </select>
            <textarea
              rows={2}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 rounded-lg body-6 bg-[var(--surface-primary)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
            <button
              type="submit"
              disabled={actionBusy}
              className="w-full h-10 sm:h-9 rounded-lg button-sm text-white bg-[#DC2626] hover:bg-[#B91C1C] cursor-pointer"
            >
              Confirm rejection
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ModerationWorkbenchClient({
  catalog,
  initialItems,
  initialStatus = "PENDING",
}: {
  catalog: FilterCatalogDto;
  initialItems: AdminQueueItemDto[];
  initialStatus?: PaperStatusValue;
}) {
  const [liveCatalog, setLiveCatalog] = useState<FilterCatalogDto>(catalog);
  const [statusTab, setStatusTab] = useState<PaperStatusValue>(initialStatus);
  const [items, setItems] = useState<AdminQueueItemDto[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItems[0]?.id ?? null
  );
  const [filterQuery, setFilterQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const refreshQueueAndCatalog = async (tab: PaperStatusValue) => {
    setLoading(true);
    try {
      const [queueRes, catRes] = await Promise.all([
        fetch(`/api/v1/admin/papers?status=${tab}`),
        fetch("/api/v1/admin/catalog"),
      ]);
      const parsed = await safeReadApiJson<AdminQueueItemDto[]>(
        queueRes,
        "Unable to load moderation queue."
      );
      if (parsed.ok && parsed.data) {
        const list = parsed.data;
        setItems(list);
        setSelectedId((prev) =>
          list.some((i) => i.id === prev) ? prev : list[0]?.id ?? null
        );
      } else if (!parsed.ok) {
        setFeedback(parsed.errorMessage);
      }
      const catParsed = await safeReadApiJson<FilterCatalogDto>(
        catRes,
        "Unable to refresh subject catalog."
      );
      if (catParsed.ok && catParsed.data) {
        setLiveCatalog(catParsed.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (tab: PaperStatusValue) => {
    setStatusTab(tab);
    setFilterQuery("");
    setFeedback("");
    void refreshQueueAndCatalog(tab);
  };

  const trimmedQuery = filterQuery.trim().toLowerCase();
  const visibleItems = trimmedQuery
    ? items.filter(
        (item) =>
          item.subjectCode.toLowerCase().includes(trimmedQuery) ||
          item.subjectName.toLowerCase().includes(trimmedQuery) ||
          item.trackingCode.toLowerCase().includes(trimmedQuery) ||
          item.branchCode.toLowerCase().includes(trimmedQuery)
      )
    : items;

  const activeIndex = visibleItems.findIndex((i) => i.id === selectedId);
  const activeItem =
    activeIndex >= 0 ? visibleItems[activeIndex] : visibleItems[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] text-[var(--text-muted)]">
            REVIEW &amp; METADATA DESK
          </p>
          <h1 className="heading-4 text-[var(--text-primary)]">
            Moderation workbench
          </h1>
          <p className="body-6 text-[var(--text-secondary)]">
            Verify uploaded PDFs, or switch to Published to edit subject names
            and tags anytime
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Submission status tabs"
          className="grid grid-cols-3 sm:inline-flex p-1 rounded-xl bg-[var(--surface-raised)]"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={statusTab === tab}
              onClick={() => handleTabSwitch(tab)}
              className={`tap-press h-10 sm:h-8 px-3 rounded-lg sm:rounded-md caption-4 whitespace-nowrap cursor-pointer ${
                statusTab === tab
                  ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {tab === "PENDING"
                ? "Pending review"
                : tab === "APPROVED"
                  ? "Published"
                  : "Rejected"}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded-xl px-4 py-3 body-6"
          style={{
            backgroundColor: "var(--badge-regular-bg)",
            color: "var(--badge-regular-text)",
            border: "1px solid var(--badge-regular-border)",
          }}
        >
          {feedback}
        </div>
      )}

      {loading ? (
        <PaperCardListSkeleton count={3} />
      ) : items.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center space-y-2"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <p className="title-3 text-[var(--text-primary)]">
            No submissions in {statusTab.toLowerCase()} queue
          </p>
          <p className="body-6 text-[var(--text-secondary)]">
            New student uploads appear here automatically for inspection.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative sm:w-80 shrink-0">
              <MagnifyingGlass
                size={15}
                weight="regular"
                className="absolute left-3 top-3 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter by code, subject, or PV code"
                aria-label="Filter moderation papers"
                className="w-full h-10 pl-9 pr-3 rounded-xl text-base sm:text-sm bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                style={{ border: "1px solid var(--border-primary)" }}
              />
            </div>

            <div
              className="flex-1 min-w-0 rounded-xl p-2 flex items-center gap-2"
              style={{
                backgroundColor: "var(--surface-primary)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <button
                type="button"
                disabled={activeIndex <= 0}
                onClick={() =>
                  activeIndex > 0 && setSelectedId(visibleItems[activeIndex - 1].id)
                }
                aria-label="Previous submission"
                className="w-9 h-9 shrink-0 rounded-lg inline-flex items-center justify-center bg-[var(--surface-raised)] disabled:opacity-40 cursor-pointer"
              >
                <CaretLeft size={16} weight="regular" />
              </button>

              <div className="flex-1 flex items-center gap-2 overflow-x-auto py-0.5">
                {visibleItems.length === 0 ? (
                  <span className="px-2 caption-5 text-[var(--text-muted)]">
                    No matching papers for &ldquo;{filterQuery.trim()}&rdquo;
                  </span>
                ) : (
                  visibleItems.map((item) => {
                    const active = item.id === activeItem?.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors duration-200 ${
                          active
                            ? "bg-[var(--surface-raised)]"
                            : "hover:bg-[var(--surface-raised)]"
                        }`}
                        style={{
                          border: active
                            ? "1px solid #2563EB"
                            : "1px solid var(--border-primary)",
                        }}
                      >
                        <span className="font-mono caption-4 text-[var(--text-primary)]">
                          {item.subjectCode}
                        </span>
                        <span className="body-6 text-[var(--text-secondary)] max-w-[160px] truncate">
                          {item.subjectName}
                        </span>
                        <ExamTypeBadge examType={item.examType} />
                        <span className="font-mono caption-5 text-[var(--text-muted)]">
                          {item.trackingCode}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                disabled={
                  activeIndex < 0 || activeIndex >= visibleItems.length - 1
                }
                onClick={() =>
                  activeIndex < visibleItems.length - 1 &&
                  setSelectedId(visibleItems[activeIndex + 1].id)
                }
                aria-label="Next submission"
                className="w-9 h-9 shrink-0 rounded-lg inline-flex items-center justify-center bg-[var(--surface-raised)] disabled:opacity-40 cursor-pointer"
              >
                <CaretRight size={16} weight="regular" />
              </button>
            </div>
          </div>

          {activeItem && (
            <QueueInspector
              key={`${activeItem.id}:${activeItem.subjectCode}:${activeItem.subjectName}`}
              activeItem={activeItem}
              catalog={liveCatalog}
              statusTab={statusTab}
              onDone={() => refreshQueueAndCatalog(statusTab)}
              onFeedback={setFeedback}
            />
          )}
        </div>
      )}
    </div>
  );
}

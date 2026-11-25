import {
  ArrowCounterClockwise,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { ExamTypeValue, PaperStatusValue } from "@/lib/btech";
import { EXAM_TYPE_META } from "@/lib/btech";

export function ExamTypeBadge({ examType }: { examType: ExamTypeValue }) {
  const meta = EXAM_TYPE_META[examType];

  if (examType === "SUPPLY") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md caption-4"
        style={{
          backgroundColor: "var(--badge-supply-bg)",
          color: "var(--badge-supply-text)",
          border: "1px solid var(--badge-supply-border)",
        }}
      >
        <ArrowCounterClockwise size={14} weight="regular" aria-hidden="true" />
        <span>{meta.shortLabel}</span>
      </span>
    );
  }

  if (examType === "REGULAR") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md caption-4"
        style={{
          backgroundColor: "var(--badge-regular-bg)",
          color: "var(--badge-regular-text)",
          border: "1px solid var(--badge-regular-border)",
        }}
      >
        <CheckCircle size={14} weight="regular" aria-hidden="true" />
        <span>{meta.shortLabel}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md caption-4 text-[var(--text-secondary)] bg-[var(--surface-raised)]"
      style={{ border: "1px solid var(--border-primary)" }}
    >
      <FileText size={14} weight="regular" aria-hidden="true" />
      <span>{meta.shortLabel}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: PaperStatusValue }) {
  if (status === "APPROVED") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md caption-4"
        style={{
          backgroundColor: "var(--badge-regular-bg)",
          color: "var(--badge-regular-text)",
          border: "1px solid var(--badge-regular-border)",
        }}
      >
        <CheckCircle size={14} weight="regular" aria-hidden="true" />
        <span>Published</span>
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md caption-4"
        style={{
          backgroundColor: "var(--badge-rejected-bg)",
          color: "var(--badge-rejected-text)",
          border: "1px solid var(--badge-rejected-border)",
        }}
      >
        <XCircle size={14} weight="regular" aria-hidden="true" />
        <span>Rejected</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md caption-4"
      style={{
        backgroundColor: "var(--badge-pending-bg)",
        color: "var(--badge-pending-text)",
        border: "1px solid var(--badge-pending-border)",
      }}
    >
      <Clock size={14} weight="regular" aria-hidden="true" />
      <span>Pending review</span>
    </span>
  );
}

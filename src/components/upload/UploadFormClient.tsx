"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import {
  ArrowCounterClockwise,
  Camera,
  Check,
  CheckCircle,
  Copy,
  FilePdf,
  Images,
  MagicWand,
  ShieldCheck,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import type { FilterCatalogDto } from "@/types/paper";
import { safeReadApiJson } from "@/lib/httpClient";
import {
  formatFileSize,
  getSemestersForYear,
  type ExamTypeValue,
} from "@/lib/btech";
import { MAX_PDF_BYTES, MAX_PDF_MB } from "@/server/validators/pdfValidator";
import {
  convertImagesToPdf,
  isImageFile,
  isPdfFile,
  scanPaperFileInBrowser,
  type PaperScanOutcome,
} from "@/lib/browserPaperTools";

interface PhotoPageItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface UploadFormClientProps {
  catalog: FilterCatalogDto;
  defaultYear?: number;
  defaultSem?: number;
  defaultExamType?: ExamTypeValue;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const EMPTY_SUBSCRIBE = () => () => {};

export function UploadFormClient({
  catalog,
  defaultYear,
  defaultSem,
  defaultExamType,
}: UploadFormClientProps) {
  const initYear = defaultYear ?? 2;
  const validSems = getSemestersForYear(initYear);
  const initSem =
    defaultSem && (validSems[0] === defaultSem || validSems[1] === defaultSem)
      ? defaultSem
      : validSems[1];

  const [file, setFile] = useState<File | null>(null);
  const [clientPages, setClientPages] = useState<number | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [photoPages, setPhotoPages] = useState<PhotoPageItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState("");
  const [scanOutcome, setScanOutcome] = useState<PaperScanOutcome | null>(null);
  const hydrated = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendPhotosRef = useRef(false);
  const scanGenRef = useRef(0);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const photoUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    photoUrlsRef.current = photoPages.map((p) => p.previewUrl);
  }, [photoPages]);

  useEffect(() => {
    return () => {
      for (const url of photoUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const [yearOfStudy, setYearOfStudy] = useState<number>(initYear);
  const [semester, setSemester] = useState<number>(initSem);
  const [branchId, setBranchId] = useState<string>(
    catalog.branches[0]?.id ?? ""
  );
  const [regulationId, setRegulationId] = useState<string>(
    catalog.regulations[0]?.id ?? ""
  );
  const [subjectId, setSubjectId] = useState<string>("");
  const [useCustomSubject, setUseCustomSubject] = useState(false);
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [customSubjectName, setCustomSubjectName] = useState("");

  const [examType, setExamType] = useState<ExamTypeValue>(
    defaultExamType ?? "REGULAR"
  );
  const [examMonth, setExamMonth] = useState<number>(11);
  const [examYear, setExamYear] = useState<number>(2025);
  const [setLabel, setSetLabel] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState<{
    trackingCode: string;
    pageCount: number;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const semesterChoices = getSemestersForYear(yearOfStudy);

  const matchingSubjects = useMemo(() => {
    return catalog.subjects.filter(
      (s) =>
        s.yearOfStudy === yearOfStudy &&
        s.semester === semester &&
        (s.branchId === branchId || s.isCommonFirstYear)
    );
  }, [catalog.subjects, yearOfStudy, semester, branchId]);

  const clearPhotoPages = () => {
    setPhotoPages((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
  };

  const applyDetectedMetadata = (outcome: PaperScanOutcome) => {
    const m = outcome.metadata;
    const dirty = dirtyFieldsRef.current;

    if (!dirty.has("yearOfStudy") && m.yearOfStudy && m.semester) {
      setYearOfStudy(m.yearOfStudy);
      setSemester(m.semester);
    } else if (!dirty.has("semester") && !dirty.has("yearOfStudy") && m.semester) {
      setSemester(m.semester);
    }
    if (!dirty.has("branchId") && m.branchId) {
      setBranchId(m.branchId);
    }
    if (!dirty.has("regulationId") && m.regulationId) {
      setRegulationId(m.regulationId);
    }
    if (!dirty.has("examType") && m.examType) {
      setExamType(m.examType);
    }
    if (!dirty.has("examMonth") && m.examMonth) {
      setExamMonth(m.examMonth);
    }
    if (!dirty.has("examYear") && m.examYear) {
      setExamYear(m.examYear);
    }
    if (!dirty.has("subject")) {
      if (m.matchedCatalogSubject && m.subjectId) {
        setUseCustomSubject(false);
        setSubjectId(m.subjectId);
      } else if (m.subjectCode || m.subjectName) {
        setUseCustomSubject(true);
        if (m.subjectCode) setCustomSubjectCode(m.subjectCode);
        if (m.subjectName) setCustomSubjectName(m.subjectName);
      }
    }
  };

  const runAutoScan = async (
    pdfBytes: Uint8Array,
    photoCanvas?: HTMLCanvasElement | null
  ) => {
    const generation = ++scanGenRef.current;
    setScanning(true);
    setScanOutcome(null);
    setScanStatusText(
      photoCanvas
        ? "Scanning photo for subject code and name..."
        : "Scanning PDF for subject code and name..."
    );

    try {
      const outcome = await scanPaperFileInBrowser({
        pdfBytes,
        photoCanvas,
        catalog,
        onProgress: (msg) => {
          if (generation === scanGenRef.current) setScanStatusText(msg);
        },
      });
      if (generation !== scanGenRef.current) return;
      setScanOutcome(outcome);
      applyDetectedMetadata(outcome);
      setScanStatusText("");
    } catch {
      if (generation !== scanGenRef.current) return;
      setScanStatusText(
        "Auto-scan unavailable for this file — verify and fill details below."
      );
    } finally {
      if (generation === scanGenRef.current) {
        setScanning(false);
      }
    }
  };

  const rebuildPdfFromPhotos = async (items: PhotoPageItem[]) => {
    if (items.length === 0) {
      scanGenRef.current += 1;
      setFile(null);
      setClientPages(null);
      setScanOutcome(null);
      setScanStatusText("");
      return;
    }

    setFileError("");
    setScanning(true);
    setScanStatusText("Converting photos to PDF...");
    try {
      const { pdfFile, pdfBytes, pageCount, firstPageCanvas } =
        await convertImagesToPdf(
          items.map((item) => item.file),
          (msg) => setScanStatusText(msg)
        );
      setFile(pdfFile);
      setClientPages(pageCount);
      await runAutoScan(pdfBytes, firstPageCanvas);
    } catch (err) {
      setScanning(false);
      setScanStatusText("");
      setFile(null);
      setClientPages(null);
      setFileError(
        err instanceof Error
          ? err.message
          : "Unable to convert selected photos into a PDF."
      );
    }
  };

  const handleFilesSelected = async (
    pickedList: FileList | File[] | null,
    appendPhotos = false
  ) => {
    setFileError("");
    const picked = pickedList ? Array.from(pickedList) : [];
    if (picked.length === 0) return;

    if (!appendPhotos) {
      dirtyFieldsRef.current = new Set();
    }

    const firstIsPdf = picked.length === 1 && isPdfFile(picked[0]);
    if (firstIsPdf) {
      const pdfFile = picked[0];
      clearPhotoPages();
      setClientPages(null);
      setScanOutcome(null);
      setScanStatusText("");

      if (pdfFile.size > MAX_PDF_BYTES) {
        setFileError(`Upload failed. File exceeds the ${MAX_PDF_MB} MB limit.`);
        setFile(null);
        return;
      }

      try {
        const buf = new Uint8Array(await pdfFile.arrayBuffer());
        const doc = await PDFDocument.load(buf, { ignoreEncryption: false });
        const count = doc.getPageCount();
        if (count < 1) {
          setFileError("Selected PDF has zero pages.");
          setFile(null);
          return;
        }
        setFile(pdfFile);
        setClientPages(count);
        void runAutoScan(buf, null);
      } catch {
        setFileError("Selected file is not a readable, unencrypted PDF.");
        setFile(null);
      }
      return;
    }

    if (picked.every((item) => isImageFile(item))) {
      const nextPhotos: PhotoPageItem[] = picked
        .slice(0, 12)
        .map((imgFile, idx) => ({
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          file: imgFile,
          previewUrl: URL.createObjectURL(imgFile),
        }));

      let combined: PhotoPageItem[];
      if (appendPhotos && photoPages.length > 0) {
        const remainingSlots = Math.max(0, 12 - photoPages.length);
        const accepted = nextPhotos.slice(0, remainingSlots);
        for (const extra of nextPhotos.slice(remainingSlots)) {
          URL.revokeObjectURL(extra.previewUrl);
        }
        combined = [...photoPages, ...accepted];
      } else {
        clearPhotoPages();
        combined = nextPhotos;
      }

      setPhotoPages(combined);
      await rebuildPdfFromPhotos(combined);
      return;
    }

    setFileError(
      "Upload a single PDF file, or one/multiple JPG, PNG, or WebP photos."
    );
  };

  const handleRemovePhotoPage = async (id: string) => {
    const target = photoPages.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    const next = photoPages.filter((p) => p.id !== id);
    setPhotoPages(next);
    await rebuildPdfFromPhotos(next);
  };

  const handleYearChange = (nextYear: number) => {
    dirtyFieldsRef.current.add("yearOfStudy");
    setYearOfStudy(nextYear);
    const [s1] = getSemestersForYear(nextYear);
    setSemester(s1);
    setSubjectId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!file) {
      setSubmitError("Attach a valid PDF question paper first.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("branchId", branchId);
      fd.set("regulationId", regulationId);
      fd.set("yearOfStudy", String(yearOfStudy));
      fd.set("semester", String(semester));
      if (!useCustomSubject && subjectId) {
        fd.set("subjectId", subjectId);
      } else {
        fd.set("customSubjectCode", customSubjectCode.trim());
        fd.set("customSubjectName", customSubjectName.trim());
      }
      fd.set("examType", examType);
      fd.set("examMonth", String(examMonth));
      fd.set("examYear", String(examYear));
      if (setLabel.trim()) fd.set("setLabel", setLabel.trim());
      if (uploaderName.trim()) fd.set("uploaderName", uploaderName.trim());
      if (uploaderEmail.trim()) fd.set("uploaderEmail", uploaderEmail.trim());
      fd.set("website", honeypot);

      const res = await fetch("/api/v1/uploads", {
        method: "POST",
        body: fd,
      });
      const parsed = await safeReadApiJson<{ trackingCode: string; pageCount: number }>(
        res,
        "Unable to submit question paper."
      );
      if (!parsed.ok || !parsed.data) {
        setSubmitError(parsed.errorMessage);
        return;
      }
      setReceipt({
        trackingCode: parsed.data.trackingCode,
        pageCount: parsed.data.pageCount,
      });
    } catch {
      setSubmitError("Unable to reach upload endpoint.");
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div
        className="max-w-xl mx-auto rounded-2xl p-6 space-y-5"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: "var(--badge-regular-bg)",
              color: "var(--badge-regular-text)",
            }}
          >
            <CheckCircle size={22} weight="regular" />
          </span>
          <div>
            <h1 className="heading-6 text-[var(--text-primary)]">
              Question paper submitted for review
            </h1>
            <p className="body-6 text-[var(--text-secondary)]">
              Your {receipt.pageCount} page PDF is safely queued for admin approval.
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-4 flex items-center justify-between gap-3 bg-[var(--surface-raised)]"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          <div>
            <p className="caption-4 text-[var(--text-muted)]">Tracking code</p>
            <p className="font-mono heading-6 text-[var(--text-primary)] mt-0.5">
              {receipt.trackingCode}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(receipt.trackingCode);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 1800);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg button-sm bg-[var(--surface-primary)] text-[var(--text-primary)] cursor-pointer"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {copiedCode ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedCode ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/track?code=${encodeURIComponent(receipt.trackingCode)}`}
            className="inline-flex items-center h-9 px-4 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            Track approval status
          </Link>
          <button
            type="button"
            onClick={() => {
              scanGenRef.current += 1;
              dirtyFieldsRef.current = new Set();
              clearPhotoPages();
              setReceipt(null);
              setFile(null);
              setClientPages(null);
              setScanOutcome(null);
              setScanStatusText("");
              setUseCustomSubject(false);
              setSubjectId("");
              setCustomSubjectCode("");
              setCustomSubjectName("");
            }}
            className="h-10 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] cursor-pointer"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            Upload another paper
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-upload-ready={hydrated ? "true" : "false"}
      className="max-w-2xl mx-auto rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6"
      style={{
        backgroundColor: "var(--surface-primary)",
        border: "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="rounded-xl p-3 flex items-start gap-3 bg-[var(--surface-raised)]"
        style={{ border: "1px solid var(--border-primary)" }}
      >
        <ShieldCheck
          size={20}
          weight="regular"
          className="text-[#2563EB] shrink-0 mt-0.5"
        />
        <p className="body-6 text-[var(--text-secondary)]">
          Upload a PDF or question paper photos (auto-converted to PDF). We
          scan page 1 locally to detect Subject Code &amp; Name automatically, and
          papers go live after admin approval.
        </p>
      </div>

      <div className="space-y-2.5">
        <label className="block title-4 text-[var(--text-primary)]">
          Question paper PDF or photos (max {MAX_PDF_MB} MB)
        </label>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            appendPhotosRef.current = false;
            void handleFilesSelected(e.dataTransfer.files, false);
          }}
          className={`flex flex-col items-center justify-center rounded-xl p-5 sm:p-6 text-center cursor-pointer transition-colors duration-200 ${
            dragOver ? "bg-[#2563EB]/10" : "bg-[var(--surface-raised)]"
          }`}
          style={{
            border: dragOver
              ? "1.5px dashed #2563EB"
              : "1.5px dashed var(--border-strong)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const append = appendPhotosRef.current;
              appendPhotosRef.current = false;
              const filesSnapshot = e.target.files
                ? Array.from(e.target.files)
                : [];
              e.target.value = "";
              void handleFilesSelected(filesSnapshot, append);
            }}
          />
          {file ? (
            <div className="flex items-center gap-3">
              {photoPages.length > 0 ? (
                <Images size={24} weight="regular" className="text-[#2563EB] shrink-0" />
              ) : (
                <FilePdf size={24} weight="regular" className="text-[#2563EB] shrink-0" />
              )}
              <div className="text-left min-w-0">
                <p className="title-4 text-[var(--text-primary)] truncate max-w-[240px] sm:max-w-md">
                  {file.name}
                </p>
                <p className="font-mono caption-5 text-[var(--text-muted)] tabular-nums">
                  {formatFileSize(file.size)} · {clientPages} pages verified
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                <UploadSimple size={22} weight="regular" />
                <Camera size={22} weight="regular" />
              </div>
              <p className="body-5 text-[var(--text-primary)]">
                Drop a PDF or tap to upload / snap question paper photos
              </p>
              <p className="caption-5 text-[var(--text-muted)]">
                Supports unencrypted PDFs and JPG/PNG/WebP photos (up to 12 pages)
              </p>
            </div>
          )}
        </label>

        {photoPages.length > 0 && (
          <div className="rounded-xl p-3 space-y-2 bg-[var(--surface-raised)] border border-[var(--border-primary)]">
            <div className="flex items-center justify-between gap-2">
              <span className="caption-4 text-[var(--text-secondary)]">
                Photo pages combined into PDF ({photoPages.length}/12)
              </span>
              {photoPages.length < 12 && (
                <button
                  type="button"
                  onClick={() => {
                    appendPhotosRef.current = true;
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg caption-4 text-[#2563EB] bg-[var(--surface-primary)] border border-[var(--border-primary)] cursor-pointer"
                >
                  <Camera size={14} />
                  <span>Add page</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {photoPages.map((p, idx) => (
                <div
                  key={p.id}
                  className="relative shrink-0 w-16 h-20 rounded-lg overflow-hidden border border-[var(--border-primary)] bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.previewUrl}
                    alt={`Question paper page ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/75 text-white font-mono text-[10px]">
                    P{idx + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove photo page ${idx + 1}`}
                    onClick={() => void handleRemovePhotoPage(p.id)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/75 text-white flex items-center justify-center cursor-pointer"
                  >
                    <Trash size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(scanning || scanStatusText || scanOutcome) && (
          <div
            role="status"
            className="rounded-xl p-3 flex items-start gap-2.5"
            style={{
              backgroundColor:
                scanOutcome && scanOutcome.metadata.detectedFields.length > 0
                  ? "var(--badge-regular-bg)"
                  : "var(--surface-raised)",
              color:
                scanOutcome && scanOutcome.metadata.detectedFields.length > 0
                  ? "var(--badge-regular-text)"
                  : "var(--text-secondary)",
              border:
                scanOutcome && scanOutcome.metadata.detectedFields.length > 0
                  ? "1px solid var(--badge-regular-border)"
                  : "1px solid var(--border-primary)",
            }}
          >
            <MagicWand size={18} className="shrink-0 mt-0.5" />
            <div className="caption-4 space-y-0.5">
              {scanning ? (
                <p>{scanStatusText || "Scanning paper details..."}</p>
              ) : scanOutcome ? (
                scanOutcome.metadata.detectedFields.length > 0 ? (
                  <p>
                    Auto-filled via{" "}
                    {scanOutcome.method === "pdf_text"
                      ? "PDF text scan"
                      : scanOutcome.method === "ocr_photo"
                        ? "Photo OCR"
                        : "Scanned PDF OCR"}
                    :{" "}
                    <strong>
                      {[
                        scanOutcome.metadata.subjectCode,
                        scanOutcome.metadata.subjectName,
                      ]
                        .filter(Boolean)
                        .join(" — ") ||
                        scanOutcome.metadata.detectedFields.join(", ")}
                    </strong>
                    {" ("}
                    {scanOutcome.metadata.detectedFields.join(", ")}
                    {"). Verify details below."}
                  </p>
                ) : (
                  <p>
                    Scanned{" "}
                    {scanOutcome.method === "pdf_text" ? "PDF" : "photo"} —
                    no subject header matched automatically. Enter details
                    below.
                  </p>
                )
              ) : (
                <p>{scanStatusText}</p>
              )}
            </div>
          </div>
        )}

        {fileError && (
          <p role="alert" className="caption-4 text-[var(--badge-rejected-text)]">
            {fileError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="up-year"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Academic year
          </label>
          <select
            id="up-year"
            value={yearOfStudy}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <option value={1}>1st Year (1-1 / 1-2)</option>
            <option value={2}>2nd Year (2-1 / 2-2)</option>
            <option value={3}>3rd Year (3-1 / 3-2)</option>
            <option value={4}>4th Year (4-1 / 4-2)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="up-sem"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Semester
          </label>
          <select
            id="up-sem"
            value={semester}
            onChange={(e) => {
              dirtyFieldsRef.current.add("semester");
              setSemester(Number(e.target.value));
              setSubjectId("");
            }}
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {semesterChoices.map((s) => (
              <option key={s} value={s}>
                Semester {s} ({yearOfStudy}-{s % 2 === 1 ? 1 : 2})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="up-branch"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Branch
          </label>
          <select
            id="up-branch"
            value={branchId}
            onChange={(e) => {
              dirtyFieldsRef.current.add("branchId");
              setBranchId(e.target.value);
              setSubjectId("");
            }}
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {catalog.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="up-reg"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Regulation
          </label>
          <select
            id="up-reg"
            value={regulationId}
            onChange={(e) => {
              dirtyFieldsRef.current.add("regulationId");
              setRegulationId(e.target.value);
            }}
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {catalog.regulations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} ({r.startYear})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="up-subject"
            className="title-4 text-[var(--text-primary)]"
          >
            Subject
          </label>
          <button
            type="button"
            onClick={() => {
              dirtyFieldsRef.current.add("subject");
              setUseCustomSubject((prev) => !prev);
            }}
            className="caption-4 text-[#2563EB] hover:underline cursor-pointer"
          >
            {useCustomSubject
              ? "Choose from listed subjects"
              : "Subject not listed? Enter manually"}
          </button>
        </div>

        {!useCustomSubject ? (
          <select
            id="up-subject"
            value={subjectId}
            onChange={(e) => {
              dirtyFieldsRef.current.add("subject");
              setSubjectId(e.target.value);
            }}
            required={!useCustomSubject}
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <option value="">
              {matchingSubjects.length > 0
                ? "Select subject"
                : "No seeded subjects for this filter — switch to manual entry"}
            </option>
            {matchingSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={customSubjectCode}
              onChange={(e) => {
                dirtyFieldsRef.current.add("subject");
                setCustomSubjectCode(e.target.value);
              }}
              placeholder="Code (e.g. CS405)"
              required={useCustomSubject}
              className="h-11 sm:h-10 px-3 rounded-lg font-mono text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
            <input
              type="text"
              value={customSubjectName}
              onChange={(e) => {
                dirtyFieldsRef.current.add("subject");
                setCustomSubjectName(e.target.value);
              }}
              placeholder="Full subject name"
              required={useCustomSubject}
              className="sm:col-span-2 h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
              style={{ border: "1px solid var(--border-primary)" }}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <span className="block title-4 text-[var(--text-primary)]">
          Exam category
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { value: "REGULAR", label: "Regular" },
              { value: "SUPPLY", label: "Supply" },
              { value: "MID_1", label: "Midterm 1" },
              { value: "MID_2", label: "Midterm 2" },
            ] as const
          ).map((opt) => {
            const active = examType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  dirtyFieldsRef.current.add("examType");
                  setExamType(opt.value);
                }}
                aria-pressed={active}
                className={`h-10 px-3 rounded-lg flex items-center justify-center gap-1.5 caption-4 transition-colors duration-200 cursor-pointer ${
                  active
                    ? "bg-[#2563EB] text-white"
                    : "bg-[var(--surface-raised)] text-[var(--text-primary)]"
                }`}
                style={{ border: "1px solid var(--border-primary)" }}
              >
                {opt.value === "SUPPLY" ? (
                  <ArrowCounterClockwise size={15} weight="regular" />
                ) : (
                  <CheckCircle size={15} weight="regular" />
                )}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="up-month"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Exam month
          </label>
          <select
            id="up-month"
            value={examMonth}
            onChange={(e) => {
              dirtyFieldsRef.current.add("examMonth");
              setExamMonth(Number(e.target.value));
            }}
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="up-exam-year"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Exam year
          </label>
          <input
            id="up-exam-year"
            type="number"
            min={2010}
            max={2035}
            value={examYear}
            onChange={(e) => {
              dirtyFieldsRef.current.add("examYear");
              setExamYear(Number(e.target.value));
            }}
            className="w-full h-11 sm:h-10 px-3 rounded-lg font-mono text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          />
        </div>

        <div>
          <label
            htmlFor="up-set"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Set label (optional)
          </label>
          <input
            id="up-set"
            type="text"
            value={setLabel}
            onChange={(e) => setSetLabel(e.target.value)}
            placeholder="e.g. Set A"
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="up-name"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            Your name (optional)
          </label>
          <input
            id="up-name"
            type="text"
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            placeholder="Contributor name"
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          />
        </div>

        <div>
          <label
            htmlFor="up-email"
            className="block title-4 text-[var(--text-primary)] mb-1.5"
          >
            College email (optional)
          </label>
          <input
            id="up-email"
            type="email"
            value={uploaderEmail}
            onChange={(e) => setUploaderEmail(e.target.value)}
            placeholder="student@college.edu"
            className="w-full h-11 sm:h-10 px-3 rounded-lg text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)]"
            style={{ border: "1px solid var(--border-primary)" }}
          />
        </div>
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave blank</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-lg p-3 body-6"
          style={{
            backgroundColor: "var(--badge-rejected-bg)",
            color: "var(--badge-rejected-text)",
            border: "1px solid var(--badge-rejected-border)",
          }}
        >
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/"
          className="h-10 px-4 inline-flex items-center rounded-lg button-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-60 transition-[background-color,transform] duration-200 cursor-pointer"
        >
          <UploadSimple size={16} weight="regular" />
          <span>{submitting ? "Submitting PDF" : "Submit for approval"}</span>
        </button>
      </div>
    </form>
  );
}

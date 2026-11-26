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
  CircleNotch,
  Copy,
  FilePdf,
  Images,
  MagicWand,
  ShieldCheck,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import type { FilterCatalogDto } from "@/types/paper";
import { uploadFormWithProgress } from "@/lib/httpClient";
import {
  formatFileSize,
  getSemestersForYear,
  type ExamTypeValue,
} from "@/lib/btech";
import { MAX_PDF_BYTES, MAX_PDF_MB } from "@/server/validators/pdfValidator";
import {
  cloneFileIntoMemory,
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

const DEFAULT_ACCEPT = "application/pdf,.pdf,image/*";

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
  const [convertingPhotos, setConvertingPhotos] = useState(false);
  const [photoNotice, setPhotoNotice] = useState("");
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
  const photoOpGenRef = useRef(0);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const photoPagesRef = useRef<PhotoPageItem[]>([]);
  const photoUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    photoPagesRef.current = photoPages;
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"uploading" | "saving" | "">(
    ""
  );
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

  const setPhotoPagesSynced = (next: PhotoPageItem[]) => {
    photoPagesRef.current = next;
    setPhotoPages(next);
  };

  const clearPhotoPages = () => {
    for (const item of photoPagesRef.current) {
      URL.revokeObjectURL(item.previewUrl);
    }
    setPhotoPagesSynced([]);
    setPhotoNotice("");
  };

  const openPicker = (mode: "camera" | "files", append: boolean) => {
    const input = fileInputRef.current;
    if (!input) return;
    appendPhotosRef.current = append;
    if (mode === "camera") {
      input.accept = "image/*";
      input.setAttribute("capture", "environment");
    } else {
      input.accept = DEFAULT_ACCEPT;
      input.removeAttribute("capture");
    }
    input.click();
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
        ? "Reading photo for subject code and title..."
        : "Scanning PDF for subject code and title..."
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
        "Auto-scan unavailable for this file. Please check the fields below."
      );
    } finally {
      if (generation === scanGenRef.current) {
        setScanning(false);
      }
    }
  };

  const rebuildPdfFromPhotos = async (items: PhotoPageItem[]) => {
    const opId = ++photoOpGenRef.current;
    if (items.length === 0) {
      scanGenRef.current += 1;
      setConvertingPhotos(false);
      setPhotoNotice("");
      setFile(null);
      setClientPages(null);
      setScanOutcome(null);
      setScanStatusText("");
      return;
    }

    setFileError("");
    setConvertingPhotos(true);
    setPhotoNotice(`Preparing ${items.length} photo page${items.length === 1 ? "" : "s"}...`);
    try {
      const { pdfFile, pdfBytes, pageCount, firstPageCanvas } =
        await convertImagesToPdf(
          items.map((item) => item.file),
          (msg) => {
            if (opId === photoOpGenRef.current) setPhotoNotice(msg);
          }
        );
      if (opId !== photoOpGenRef.current) return;

      setFile(pdfFile);
      setClientPages(pageCount);
      setConvertingPhotos(false);
      setPhotoNotice(
        `Photo ready · ${pageCount} ${pageCount === 1 ? "page" : "pages"} converted (${formatFileSize(pdfFile.size)})`
      );
      void runAutoScan(pdfBytes, firstPageCanvas);
    } catch (err) {
      if (opId !== photoOpGenRef.current) return;
      setConvertingPhotos(false);
      setPhotoNotice("");
      setFile(null);
      setClientPages(null);
      setFileError(
        err instanceof Error
          ? err.message
          : "Unable to convert selected photo into a PDF. Try taking a clearer JPG photo."
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
      const pdfFile = await cloneFileIntoMemory(
        picked[0],
        "question_paper.pdf",
        "application/pdf"
      );
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
      setConvertingPhotos(true);
      setPhotoNotice("Capturing photo into memory...");
      const existing = photoPagesRef.current;
      const startIndex = appendPhotos ? existing.length : 0;
      const slots = Math.max(0, 12 - startIndex);
      const selectedImages = picked.slice(0, slots);

      if (selectedImages.length === 0) {
        setConvertingPhotos(false);
        setFileError("Maximum of 12 photo pages reached for one PDF.");
        return;
      }

      try {
        const copiedPhotos: PhotoPageItem[] = await Promise.all(
          selectedImages.map(async (rawImg, idx) => {
            const safeFile = await cloneFileIntoMemory(
              rawImg,
              `page_${startIndex + idx + 1}.jpg`,
              "image/jpeg"
            );
            return {
              id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              file: safeFile,
              previewUrl: URL.createObjectURL(safeFile),
            };
          })
        );

        let combined: PhotoPageItem[];
        if (appendPhotos && existing.length > 0) {
          combined = [...existing, ...copiedPhotos];
        } else {
          clearPhotoPages();
          combined = copiedPhotos;
        }

        setPhotoPagesSynced(combined);
        await rebuildPdfFromPhotos(combined);
      } catch {
        setConvertingPhotos(false);
        setPhotoNotice("");
        setFileError(
          "Could not read photo from device storage. Please snap or pick the photo again."
        );
      }
      return;
    }

    setFileError(
      "Upload a single PDF file, or one or more JPG, PNG, WebP, or HEIC photos."
    );
  };

  const handleRemovePhotoPage = async (id: string) => {
    const existing = photoPagesRef.current;
    const target = existing.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    const next = existing.filter((p) => p.id !== id);
    setPhotoPagesSynced(next);
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
    if (convertingPhotos) {
      setSubmitError("Wait a moment while your photo is converted into a PDF.");
      return;
    }
    if (!file) {
      setSubmitError("Attach a PDF or take at least one photo first.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(5);
    setUploadStage("uploading");
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

      const parsed = await uploadFormWithProgress<{
        trackingCode: string;
        pageCount: number;
      }>("/api/v1/uploads", fd, "Unable to submit question paper.", (pct) => {
        setUploadProgress(pct);
        if (pct >= 100) {
          setUploadStage("saving");
        }
      });

      if (!parsed.ok || !parsed.data) {
        setSubmitError(parsed.errorMessage);
        return;
      }
      setReceipt({
        trackingCode: parsed.data.trackingCode,
        pageCount: parsed.data.pageCount,
      });
    } catch {
      setSubmitError("Unable to reach upload endpoint. Check your connection and retry.");
    } finally {
      setSubmitting(false);
      setUploadStage("");
      setUploadProgress(0);
    }
  };

  if (receipt) {
    return (
      <div
        className="max-w-xl mx-auto rounded-2xl p-5 sm:p-6 space-y-5"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
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
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg button-sm bg-[var(--surface-primary)] text-[var(--text-primary)] cursor-pointer"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            {copiedCode ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedCode ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <Link
            href={`/track?code=${encodeURIComponent(receipt.trackingCode)}`}
            className="inline-flex items-center justify-center h-11 sm:h-10 px-4 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            Track approval status
          </Link>
          <button
            type="button"
            onClick={() => {
              scanGenRef.current += 1;
              photoOpGenRef.current += 1;
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
            className="h-11 sm:h-10 px-4 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] cursor-pointer"
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
      className="max-w-2xl mx-auto space-y-5"
    >
      <div
        className="rounded-xl p-3.5 flex items-start gap-3 bg-[var(--surface-primary)]"
        style={{ border: "1px solid var(--border-primary)" }}
      >
        <ShieldCheck
          size={20}
          weight="regular"
          className="text-[#2563EB] shrink-0 mt-0.5"
        />
        <p className="body-6 text-[var(--text-secondary)]">
          Upload a PDF or snap photos of each page (converted to PDF on your device).
          Page 1 is scanned automatically before entering admin review.
        </p>
      </div>

      <section
        aria-label="Step 1: Add question paper file or camera photos"
        className="rounded-2xl p-4 sm:p-6 space-y-4"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="title-4 text-[var(--text-primary)]">
            1. Question paper file or photos (max {MAX_PDF_MB} MB)
          </span>
          {file && (
            <button
              type="button"
              onClick={() => {
                clearPhotoPages();
                setFile(null);
                setClientPages(null);
                setScanOutcome(null);
                setScanStatusText("");
                setFileError("");
              }}
              className="caption-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={DEFAULT_ACCEPT}
          aria-label="Upload question paper PDF or photos"
          className="sr-only"
          onChange={async (e) => {
            const input = e.currentTarget;
            const append = appendPhotosRef.current;
            appendPhotosRef.current = false;
            const filesSnapshot = input.files ? Array.from(input.files) : [];
            try {
              await handleFilesSelected(filesSnapshot, append);
            } finally {
              input.value = "";
              input.accept = DEFAULT_ACCEPT;
              input.removeAttribute("capture");
            }
          }}
        />

        <div
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
          className={`rounded-xl p-4 sm:p-5 text-center transition-colors duration-200 space-y-3 ${
            dragOver ? "bg-[#2563EB]/10" : "bg-[var(--surface-raised)]"
          }`}
          style={{
            border: dragOver
              ? "1.5px dashed #2563EB"
              : "1.5px dashed var(--border-strong)",
          }}
        >
          {file ? (
            <div className="flex items-center justify-center sm:justify-start gap-3">
              {photoPages.length > 0 ? (
                <Images size={24} weight="regular" className="text-[#2563EB] shrink-0" />
              ) : (
                <FilePdf size={24} weight="regular" className="text-[#2563EB] shrink-0" />
              )}
              <div className="text-left min-w-0">
                <p className="title-4 text-[var(--text-primary)] truncate max-w-[230px] sm:max-w-md">
                  {file.name}
                </p>
                <p className="font-mono caption-5 text-[var(--text-muted)] tabular-nums">
                  {formatFileSize(file.size)} · {clientPages} pages verified
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="body-5 text-[var(--text-primary)]">
                Snap camera pages or attach a PDF
              </p>
              <p className="caption-5 text-[var(--text-muted)]">
                Supports PDF, JPG, PNG, WebP, or HEIC (up to 12 pages)
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={convertingPhotos || submitting}
              onClick={() => openPicker("camera", photoPages.length > 0)}
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-60 transition-[background-color,transform] duration-200 cursor-pointer"
            >
              <Camera size={18} weight="regular" />
              <span>
                {photoPages.length > 0 ? "Snap another page" : "Take photo"}
              </span>
            </button>

            <button
              type="button"
              disabled={convertingPhotos || submitting}
              onClick={() => openPicker("files", false)}
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl button-sm text-[var(--text-primary)] bg-[var(--surface-primary)] hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-[opacity,transform] duration-200 cursor-pointer"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              <UploadSimple size={18} weight="regular" />
              <span>Choose PDF or gallery</span>
            </button>
          </div>
        </div>

        {(convertingPhotos || photoNotice) && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
            style={{
              backgroundColor: convertingPhotos
                ? "var(--surface-raised)"
                : "var(--badge-regular-bg)",
              color: convertingPhotos
                ? "var(--text-primary)"
                : "var(--badge-regular-text)",
              border: convertingPhotos
                ? "1px solid var(--border-primary)"
                : "1px solid var(--badge-regular-border)",
            }}
          >
            <div className="flex items-center gap-2 caption-4">
              {convertingPhotos ? (
                <CircleNotch size={16} className="animate-spin shrink-0" />
              ) : (
                <CheckCircle size={16} weight="regular" className="shrink-0" />
              )}
              <span>{photoNotice}</span>
            </div>
            {!convertingPhotos && photoPages.length > 0 && photoPages.length < 12 && (
              <button
                type="button"
                onClick={() => openPicker("files", true)}
                className="caption-4 underline cursor-pointer shrink-0"
              >
                Add from gallery
              </button>
            )}
          </div>
        )}

        {photoPages.length > 0 && (
          <div className="rounded-xl p-3 space-y-2.5 bg-[var(--surface-raised)] border border-[var(--border-primary)]">
            <div className="flex items-center justify-between gap-2">
              <span className="caption-4 text-[var(--text-secondary)]">
                Combined PDF pages ({photoPages.length}/12)
              </span>
              {photoPages.length < 12 && (
                <button
                  type="button"
                  onClick={() => openPicker("camera", true)}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg caption-4 text-[#2563EB] bg-[var(--surface-primary)] border border-[var(--border-primary)] cursor-pointer"
                >
                  <Camera size={14} />
                  <span>Add page</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {photoPages.map((p, idx) => (
                <div
                  key={p.id}
                  className="relative shrink-0 w-18 h-24 rounded-lg overflow-hidden border border-[var(--border-primary)] bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.previewUrl}
                    alt={`Question paper page ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white font-mono text-[10px]">
                    P{idx + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove photo page ${idx + 1}`}
                    onClick={() => void handleRemovePhotoPage(p.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/75 text-white flex items-center justify-center cursor-pointer"
                  >
                    <Trash size={12} />
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
            {scanning ? (
              <CircleNotch size={18} className="animate-spin shrink-0 mt-0.5" />
            ) : (
              <MagicWand size={18} className="shrink-0 mt-0.5" />
            )}
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
                        .join(" · ") ||
                        scanOutcome.metadata.detectedFields.join(", ")}
                    </strong>
                    {" ("}
                    {scanOutcome.metadata.detectedFields.join(", ")}
                    {"). Verify details below."}
                  </p>
                ) : (
                  <p>
                    Scanned{" "}
                    {scanOutcome.method === "pdf_text" ? "PDF" : "photo"} · no
                    subject header matched automatically. Enter details below.
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
      </section>

      <section
        aria-label="Step 2: Exam and subject metadata"
        className="rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p className="title-4 text-[var(--text-primary)]">
          2. Subject &amp; exam details
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div>
            <label
              htmlFor="up-year"
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="up-subject"
              className="caption-4 text-[var(--text-secondary)]"
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
                  : "Select subject or switch to manual"}
              </option>
              {matchingSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
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
          <span className="block caption-4 text-[var(--text-secondary)]">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          <div>
            <label
              htmlFor="up-month"
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div>
            <label
              htmlFor="up-name"
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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
              className="block caption-4 text-[var(--text-secondary)] mb-1.5"
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

        {submitting && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl p-3.5 space-y-2 bg-[var(--surface-raised)] border border-[#2563EB]/40"
          >
            <div className="flex items-center justify-between gap-2 caption-4 text-[var(--text-primary)]">
              <span className="inline-flex items-center gap-2">
                <CircleNotch size={16} className="animate-spin text-[#2563EB]" />
                <span>
                  {uploadStage === "saving"
                    ? "Saving submission to review queue..."
                    : "Uploading question paper PDF..."}
                </span>
              </span>
              <span className="font-mono tabular-nums text-[#2563EB]">
                {uploadProgress}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--surface-primary)] overflow-hidden">
              <div
                className="h-full bg-[#2563EB] transition-[width] duration-150"
                style={{ width: `${Math.max(8, uploadProgress)}%` }}
              />
            </div>
          </div>
        )}

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

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-1">
          <Link
            href="/"
            className="h-11 sm:h-10 px-4 inline-flex items-center justify-center rounded-lg button-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-raised)] sm:bg-transparent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || convertingPhotos}
            className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-60 transition-[background-color,transform] duration-200 cursor-pointer"
          >
            {submitting ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <UploadSimple size={16} weight="regular" />
            )}
            <span>
              {submitting
                ? uploadStage === "saving"
                  ? "Saving..."
                  : `Uploading (${uploadProgress}%)`
                : "Submit for approval"}
            </span>
          </button>
        </div>
      </section>
    </form>
  );
}

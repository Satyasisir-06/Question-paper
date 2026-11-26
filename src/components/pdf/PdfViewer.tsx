"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowsOutSimple,
  ArrowsInSimple,
  ArrowClockwise,
  ArrowSquareOut,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";
import { PdfDocumentSkeleton } from "@/components/ui/Skeletons";

interface PdfViewerProps {
  src: string;
  title: string;
}

export function PdfViewer({ src, title }: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fitMode, setFitMode] = useState<"width" | "custom">("width");
  const [customZoom, setCustomZoom] = useState(1.25);
  const [rotation, setRotation] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activePage, setActivePage] = useState(1);

  // Track container width dynamically for responsive Fit-Width rendering
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(el.clientWidth);
    };
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [expanded]);

  // Load PDF document via pdfjs-dist in browser only
  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    async function loadDocument() {
      setLoading(true);
      setErrorMsg("");
      setPdfDoc(null);
      setNumPages(0);
      setActivePage(1);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        loadingTask = pdfjs.getDocument({
          url: src,
          withCredentials: true,
        });
        const doc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch {
        if (!cancelled) {
          setErrorMsg("Unable to render PDF inline.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
      if (loadingTask) {
        void loadingTask.destroy();
      }
    };
  }, [src]);

  // Render every page cleanly at crisp DPR into responsive white paper canvases
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!pdfDoc || !container || containerWidth <= 0) return;

    let cancelled = false;
    const renderTasks: RenderTask[] = [];
    const pageHost = container.querySelector("[data-pdf-pages]") as HTMLDivElement | null;
    if (!pageHost) return;

    async function renderAllPages() {
      if (!pageHost || !pdfDoc) return;
      pageHost.innerHTML = "";
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const horizontalPadding = window.innerWidth < 640 ? 16 : 36;
      const availableWidth = Math.max(240, containerWidth - horizontalPadding);

      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
        if (cancelled) return;
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1, rotation });
        const targetScale =
          fitMode === "width"
            ? availableWidth / baseViewport.width
            : customZoom;
        const cssViewport = page.getViewport({ scale: targetScale, rotation });
        const pixelViewport = page.getViewport({
          scale: targetScale * dpr,
          rotation,
        });

        const wrapper = document.createElement("div");
        wrapper.dataset.pageNumber = String(pageNumber);
        wrapper.className =
          "mx-auto bg-white rounded-md shadow-sm overflow-hidden border border-black/10 relative";
        wrapper.style.width = `${Math.floor(cssViewport.width)}px`;

        const badge = document.createElement("div");
        badge.textContent = `Page ${pageNumber} / ${pdfDoc.numPages}`;
        badge.className =
          "px-2 py-0.5 text-[11px] font-mono bg-neutral-900/75 text-white rounded absolute top-2 right-2 pointer-events-none";
        wrapper.appendChild(badge);

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(pixelViewport.width);
        canvas.height = Math.floor(pixelViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;
        canvas.style.display = "block";
        canvas.setAttribute("aria-label", `${title} page ${pageNumber}`);
        wrapper.appendChild(canvas);
        pageHost.appendChild(wrapper);

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const task = page.render({
          canvasContext: ctx,
          viewport: pixelViewport,
          canvas,
        });
        renderTasks.push(task);
        try {
          await task.promise;
        } catch {
          if (cancelled) return;
        }
      }
    }

    void renderAllPages();

    return () => {
      cancelled = true;
      for (const t of renderTasks) {
        try {
          t.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, containerWidth, fitMode, customZoom, rotation, title]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const wrappers = Array.from(
      container.querySelectorAll<HTMLElement>("[data-page-number]")
    );
    const centerY = container.scrollTop + container.clientHeight * 0.35;
    for (const el of wrappers) {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (centerY >= top && centerY <= bottom) {
        const num = Number(el.dataset.pageNumber);
        if (Number.isFinite(num)) setActivePage(num);
        break;
      }
    }
  };

  const adjustZoom = (delta: number) => {
    setFitMode("custom");
    setCustomZoom((prev) =>
      Math.max(0.6, Math.min(2.6, Number((prev + delta).toFixed(2))))
    );
  };

  const viewerShell = (
    <div
      className={
        expanded
          ? "fixed inset-0 z-[60] flex flex-col bg-[var(--surface-primary)]"
          : "w-full h-full flex flex-col rounded-lg overflow-hidden"
      }
      style={{ border: expanded ? undefined : "1px solid var(--border-primary)" }}
    >
      <div
        className="px-2.5 sm:px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0"
        style={{
          backgroundColor: "var(--surface-primary)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div className="flex items-center gap-1.5 font-mono caption-4 text-[var(--text-secondary)] tabular-nums">
          <span>
            {numPages > 0 ? `Page ${activePage} / ${numPages}` : "Loading PDF"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjustZoom(-0.2)}
            aria-label="Zoom out"
            className="inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[var(--surface-raised)] text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
          >
            <MagnifyingGlassMinus size={16} weight="regular" />
          </button>

          <button
            type="button"
            onClick={() => setFitMode("width")}
            className={`h-9 sm:h-8 px-2.5 rounded-lg caption-4 cursor-pointer ${
              fitMode === "width"
                ? "bg-[#2563EB] text-white"
                : "bg-[var(--surface-raised)] text-[var(--text-primary)]"
            }`}
          >
            Fit width
          </button>

          <button
            type="button"
            onClick={() => adjustZoom(0.2)}
            aria-label="Zoom in"
            className="inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[var(--surface-raised)] text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
          >
            <MagnifyingGlassPlus size={16} weight="regular" />
          </button>

          <button
            type="button"
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            aria-label="Rotate 90 degrees"
            title="Rotate 90 degrees"
            className="inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[var(--surface-raised)] text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
          >
            <ArrowClockwise size={16} weight="regular" />
          </button>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Exit fullscreen preview" : "Expand preview"}
            title={expanded ? "Exit fullscreen" : "Fullscreen preview"}
            className="inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[var(--surface-raised)] text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
          >
            {expanded ? (
              <ArrowsInSimple size={16} weight="regular" />
            ) : (
              <ArrowsOutSimple size={16} weight="regular" />
            )}
          </button>

          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open raw PDF in new tab"
            title="Open raw PDF"
            className="inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowSquareOut size={16} weight="regular" />
          </a>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-2 sm:p-4 bg-[#E5E7EB] dark:bg-[#101113]"
      >
        {loading && <PdfDocumentSkeleton />}

        {errorMsg && (
          <div className="max-w-md mx-auto my-8 rounded-xl p-5 text-center space-y-3 bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <p className="body-6 text-[var(--text-primary)]">{errorMsg}</p>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg button-sm text-white bg-[#2563EB]"
            >
              <ArrowSquareOut size={16} />
              <span>Open PDF directly</span>
            </a>
          </div>
        )}

        <div data-pdf-pages className="space-y-4" />
      </div>
    </div>
  );

  return viewerShell;
}

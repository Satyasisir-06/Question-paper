"use client";

import { PDFDocument } from "pdf-lib";
import type { FilterCatalogDto } from "@/types/paper";
import { MAX_PDF_BYTES, MAX_PDF_MB } from "@/server/validators/pdfValidator";
import {
  extractPaperMetadataFromText,
  type ScannedPaperMetadata,
} from "@/lib/paperScanner";

const IMAGE_EXTENSIONS = /\.(?:jpg|jpeg|png|webp|bmp|heic|heif|avif)$/i;
const PDF_EXTENSION = /\.pdf$/i;

export interface PaperScanOutcome {
  metadata: ScannedPaperMetadata;
  method: "pdf_text" | "ocr_pdf" | "ocr_photo";
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return !file.type.includes("svg");
  }
  return IMAGE_EXTENSIONS.test(file.name);
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || PDF_EXTENSION.test(file.name);
}

/** Snapshot a browser File into fresh in-memory bytes before mobile input resets. */
export async function cloneFileIntoMemory(
  file: File,
  fallbackName: string,
  fallbackType: string
): Promise<File> {
  const bytes = await file.arrayBuffer();
  return new File([bytes], file.name || fallbackName, {
    type: file.type || fallbackType,
    lastModified: file.lastModified || Date.now(),
  });
}

async function decodeImageSource(file: File): Promise<{
  width: number;
  height: number;
  drawSource: CanvasImageSource;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        width: bitmap.width,
        height: bitmap.height,
        drawSource: bitmap,
        cleanup: () => bitmap.close(),
      };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          width: bitmap.width,
          height: bitmap.height,
          drawSource: bitmap,
          cleanup: () => bitmap.close(),
        };
      } catch {
        // Fall through to HTMLImageElement decode for mobile camera formats
      }
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Unable to decode image file."));
      el.src = objectUrl;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      drawSource: img,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function renderImageToCanvas(
  file: File,
  maxWidth = 1800
): Promise<HTMLCanvasElement> {
  const decoded = await decodeImageSource(file);
  try {
    const { width, height, drawSource } = decoded;
    if (!drawSource || width <= 0 || height <= 0) {
      throw new Error("Selected photo has invalid dimensions.");
    }

    const scale = width > maxWidth ? maxWidth / width : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable in this browser.");
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(drawSource, 0, 0, targetWidth, targetHeight);
    return canvas;
  } finally {
    decoded.cleanup();
  }
}

async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob) {
    throw new Error("Unable to encode photo as PDF page.");
  }
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Convert one or more mobile camera/gallery photos into a crisp multi-page A4 PDF
 * suitable for student preview, archival storage, and ZIP folder downloads.
 */
export async function convertImagesToPdf(
  files: File[],
  onProgress?: (message: string) => void
): Promise<{
  pdfFile: File;
  pdfBytes: Uint8Array;
  pageCount: number;
  firstPageCanvas: HTMLCanvasElement | null;
}> {
  if (files.length === 0) {
    throw new Error("Select at least one photo.");
  }

  let firstPageCanvas: HTMLCanvasElement | null = null;
  const presets = [
    { maxWidth: 1800, quality: 0.88 },
    { maxWidth: 1350, quality: 0.72 },
    { maxWidth: 1120, quality: 0.6 },
  ];

  for (const preset of presets) {
    const doc = await PDFDocument.create();
    for (let idx = 0; idx < files.length; idx++) {
      onProgress?.(`Preparing photo page ${idx + 1} of ${files.length}...`);
      const canvas = await renderImageToCanvas(files[idx], preset.maxWidth);
      if (idx === 0 && preset.maxWidth === 1800) {
        firstPageCanvas = canvas;
      }
      const jpgBytes = await canvasToJpegBytes(canvas, preset.quality);
      const jpg = await doc.embedJpg(jpgBytes);
      const pageWidth = 595.28;
      const pageHeight = Math.max(200, (jpg.height / jpg.width) * pageWidth);
      const page = doc.addPage([pageWidth, pageHeight]);
      page.drawImage(jpg, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }

    const pdfBytes = await doc.save();
    if (pdfBytes.byteLength <= MAX_PDF_BYTES || preset === presets[presets.length - 1]) {
      if (pdfBytes.byteLength > MAX_PDF_BYTES) {
        throw new Error(
          `Combined photos exceed the ${MAX_PDF_MB} MB PDF limit. Upload fewer pages at once.`
        );
      }
      const baseName =
        files[0].name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_") ||
        "question_paper";
      const normalizedBytes = new Uint8Array(pdfBytes.byteLength);
      normalizedBytes.set(pdfBytes);
      const pdfFile = new File([normalizedBytes], `${baseName}.pdf`, {
        type: "application/pdf",
      });
      return {
        pdfFile,
        pdfBytes,
        pageCount: files.length,
        firstPageCanvas,
      };
    }
  }

  throw new Error("Unable to convert photos into PDF.");
}

async function extractPdfTextAndFirstCanvas(
  pdfBytes: Uint8Array,
  skipCanvasRender: boolean
): Promise<{ text: string; firstPageCanvas: HTMLCanvasElement | null }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjs.getDocument({ data: pdfBytes.slice() });
  try {
    const doc = await loadingTask.promise;
    const pageLimit = Math.min(2, doc.numPages);
    const allLines: string[] = [];

    for (let pageNo = 1; pageNo <= pageLimit; pageNo++) {
      const page = await doc.getPage(pageNo);
      const textContent = await page.getTextContent();
      const rows = new Map<number, Array<{ x: number; text: string }>>();

      for (const rawItem of textContent.items) {
        if (
          typeof rawItem === "object" &&
          rawItem !== null &&
          "str" in rawItem &&
          "transform" in rawItem &&
          typeof rawItem.str === "string" &&
          Array.isArray(rawItem.transform)
        ) {
          const textPart = rawItem.str.trim();
          if (!textPart) continue;
          const x = Number(rawItem.transform[4] ?? 0);
          const yBucket = Math.round(Number(rawItem.transform[5] ?? 0) / 5) * 5;
          const bucket = rows.get(yBucket) ?? [];
          bucket.push({ x, text: textPart });
          rows.set(yBucket, bucket);
        }
      }

      const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
      for (const y of sortedY) {
        const lineTokens = (rows.get(y) ?? []).sort((a, b) => a.x - b.x);
        const line = lineTokens.map((t) => t.text).join(" ").trim();
        if (line) allLines.push(line);
      }
    }

    const combinedText = allLines.join("\n");
    if (skipCanvasRender || combinedText.trim().length >= 40) {
      return { text: combinedText, firstPageCanvas: null };
    }

    const firstPage = await doc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { text: combinedText, firstPageCanvas: null };
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await firstPage.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    return { text: combinedText, firstPageCanvas: canvas };
  } finally {
    await loadingTask.destroy();
  }
}

async function recognizeCanvasText(
  canvas: HTMLCanvasElement,
  onProgress?: (message: string) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Running offline OCR scan on page 1...");

  const worker = await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract",
    workerBlobURL: false,
    logger: (msg) => {
      if (msg.status === "recognizing text" && typeof msg.progress === "number") {
        const pct = Math.round(msg.progress * 100);
        onProgress?.(`Scanning text (${pct}%)...`);
      }
    },
  });

  try {
    const result = await worker.recognize(canvas);
    return result.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract B.Tech question paper details locally in the browser:
 * reads text layer on digital PDFs in <150ms, or falls back to local Tesseract OCR
 * for scanned PDFs and camera photos.
 */
export async function scanPaperFileInBrowser(params: {
  pdfBytes: Uint8Array;
  photoCanvas?: HTMLCanvasElement | null;
  catalog: FilterCatalogDto;
  onProgress?: (message: string) => void;
}): Promise<PaperScanOutcome> {
  if (params.photoCanvas) {
    const text = await recognizeCanvasText(params.photoCanvas, params.onProgress);
    return {
      metadata: extractPaperMetadataFromText(text, params.catalog),
      method: "ocr_photo",
    };
  }

  params.onProgress?.("Reading PDF text for subject code and title...");
  const { text, firstPageCanvas } = await extractPdfTextAndFirstCanvas(
    params.pdfBytes,
    false
  );

  if (text.trim().length >= 40) {
    return {
      metadata: extractPaperMetadataFromText(text, params.catalog),
      method: "pdf_text",
    };
  }

  if (firstPageCanvas) {
    const ocrText = await recognizeCanvasText(firstPageCanvas, params.onProgress);
    return {
      metadata: extractPaperMetadataFromText(ocrText, params.catalog),
      method: "ocr_pdf",
    };
  }

  return {
    metadata: extractPaperMetadataFromText(text, params.catalog),
    method: "pdf_text",
  };
}

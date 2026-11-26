import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  convertImagesToPdf,
  isImageFile,
  isPdfFile,
  scanPaperFileInBrowser,
} from "@/lib/browserPaperTools";
import type { FilterCatalogDto } from "@/types/paper";

const TINY_JPEG_BYTES = new Uint8Array(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==",
    "base64"
  )
);

const TEST_CATALOG: FilterCatalogDto = {
  branches: [
    { id: "b-cse", code: "CSE", name: "Computer Science & Engineering" },
    { id: "b-csd", code: "CSD", name: "CSE (Data Science)" },
  ],
  regulations: [{ id: "r-22", code: "R22", startYear: 2022 }],
  subjects: [
    {
      id: "s-cs401",
      code: "CS401",
      name: "Database Management Systems",
      branchId: "b-cse",
      regulationId: "r-22",
      yearOfStudy: 2,
      semester: 4,
      isCommonFirstYear: false,
    },
  ],
  examYears: [2024],
};

const { mockGetDocument, mockCreateWorker, mockRecognize, mockTerminate } =
  vi.hoisted(() => ({
    mockGetDocument: vi.fn(),
    mockCreateWorker: vi.fn(),
    mockRecognize: vi.fn(),
    mockTerminate: vi.fn(),
  }));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: mockGetDocument,
}));

vi.mock("tesseract.js", () => ({
  createWorker: mockCreateWorker,
}));

function installMockCanvasEnvironment(blobPayload: Uint8Array = TINY_JPEG_BYTES) {
  const createCanvas = () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }),
    toBlob: (cb: (blob: Blob | null) => void) => {
      const copy = new Uint8Array(blobPayload.byteLength);
      copy.set(blobPayload);
      cb(new Blob([copy], { type: "image/jpeg" }));
    },
  });

  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "canvas") return createCanvas();
      throw new Error(`Unexpected tag ${tag}`);
    },
  });
}

describe("browserPaperTools (photo-to-PDF conversion & local PDF/OCR scanning)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminate.mockResolvedValue({});
    mockCreateWorker.mockImplementation(async (_lang, _oem, opts) => {
      opts?.logger?.({ status: "recognizing text", progress: 0.75 });
      return {
        recognize: mockRecognize,
        terminate: mockTerminate,
      };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects valid PDF and raster image files while rejecting SVG vectors", () => {
    expect(isPdfFile(new File(["a"], "exam.PDF", { type: "" }))).toBe(true);
    expect(
      isPdfFile(new File(["a"], "doc", { type: "application/pdf" }))
    ).toBe(true);
    expect(isImageFile(new File(["a"], "p1.jpg", { type: "image/jpeg" }))).toBe(
      true
    );
    expect(isImageFile(new File(["a"], "p2.PNG", { type: "" }))).toBe(true);
    expect(
      isImageFile(new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" }))
    ).toBe(false);
  });

  it("rejects empty photo list and handles oversized PDF retry cleanly", async () => {
    await expect(convertImagesToPdf([])).rejects.toThrow(
      /Select at least one photo/i
    );

    installMockCanvasEnvironment();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 2400, height: 3200, close: vi.fn() }))
    );

    const p1 = new File(["img1"], "front_page.png", { type: "image/png" });
    const p2 = new File(["img2"], "back_page.jpg", { type: "image/jpeg" });
    const progressMsgs: string[] = [];

    const out = await convertImagesToPdf([p1, p2], (msg) =>
      progressMsgs.push(msg)
    );
    expect(out.pageCount).toBe(2);
    expect(out.pdfFile.name).toBe("front_page.pdf");
    expect(out.pdfFile.type).toBe("application/pdf");
    expect(progressMsgs.length).toBeGreaterThanOrEqual(2);

    const parsedDoc = await PDFDocument.load(out.pdfBytes);
    expect(parsedDoc.getPageCount()).toBe(2);
  });

  it("falls back to HTMLImageElement when createImageBitmap is unavailable and guards invalid dimensions", async () => {
    installMockCanvasEnvironment();
    vi.stubGlobal("createImageBitmap", undefined);
    const revokeSpy = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-image"),
      revokeObjectURL: revokeSpy,
    });

    class MockImage {
      naturalWidth = 800;
      naturalHeight = 1100;
      width = 800;
      height = 1100;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", MockImage);

    const out = await convertImagesToPdf([
      new File(["x"], "scan.webp", { type: "image/webp" }),
    ]);
    expect(out.pageCount).toBe(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-image");

    class ZeroImage extends MockImage {
      naturalWidth = 0;
      naturalHeight = 0;
      width = 0;
      height = 0;
    }
    vi.stubGlobal("Image", ZeroImage);
    await expect(
      convertImagesToPdf([new File(["x"], "bad.jpg", { type: "image/jpeg" })])
    ).rejects.toThrow(/invalid dimensions/i);
  });

  it("scans a photo canvas directly with local Tesseract OCR worker", async () => {
    mockRecognize.mockResolvedValue({
      data: {
        text: "Year/Sem: 2-2 (Sem 4)\nBranch: CSE\nRegulation: R22\nCS401 - Database Management Systems\nSupply Nov 2024",
      },
    });

    const stages: string[] = [];
    const fakeCanvas = {} as HTMLCanvasElement;
    const result = await scanPaperFileInBrowser({
      pdfBytes: new Uint8Array([1, 2, 3]),
      photoCanvas: fakeCanvas,
      catalog: TEST_CATALOG,
      onProgress: (m) => stages.push(m),
    });

    expect(result.method).toBe("ocr_photo");
    expect(result.metadata.subjectCode).toBe("CS401");
    expect(result.metadata.subjectId).toBe("s-cs401");
    expect(mockCreateWorker).toHaveBeenCalledWith(
      "eng",
      1,
      expect.objectContaining({
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract",
        langPath: "/tesseract",
        workerBlobURL: false,
      })
    );
    expect(mockTerminate).toHaveBeenCalledTimes(1);
    expect(stages.some((s) => s.includes("75%"))).toBe(true);
  });

  it("extracts digital PDF text lines cleanly without launching OCR", async () => {
    const mockDestroy = vi.fn().mockResolvedValue(undefined);
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(async () => ({
          getTextContent: vi.fn(async () => ({
            items: [
              { str: "Database Management Systems", transform: [1, 0, 0, 1, 140, 730] },
              { str: "CS401 -", transform: [1, 0, 0, 1, 64, 730] },
              {
                str: "Year/Sem: 2-2 (Sem 4) Branch: CSE Regulation: R22 Supply Nov 2024",
                transform: [1, 0, 0, 1, 64, 760],
              },
            ],
          })),
        })),
      }),
      destroy: mockDestroy,
    });

    const res = await scanPaperFileInBrowser({
      pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      catalog: TEST_CATALOG,
    });

    expect(res.method).toBe("pdf_text");
    expect(res.metadata.subjectCode).toBe("CS401");
    expect(res.metadata.examType).toBe("SUPPLY");
    expect(mockCreateWorker).not.toHaveBeenCalled();
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it("falls back to PDF page-1 OCR when text layer has under 40 chars", async () => {
    installMockCanvasEnvironment();
    const mockDestroy = vi.fn().mockResolvedValue(undefined);
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(async () => ({
          getTextContent: vi.fn(async () => ({ items: [] })),
          getViewport: vi.fn(() => ({ width: 595, height: 842 })),
          render: vi.fn(() => ({ promise: Promise.resolve() })),
        })),
      }),
      destroy: mockDestroy,
    });

    mockRecognize.mockResolvedValue({
      data: {
        text: "Code No: CS555\nSubject Name: Graph Neural Networks\nBranch: CSD\nIII B.Tech II Sem Mid-II 04/2025",
      },
    });

    const res = await scanPaperFileInBrowser({
      pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      catalog: TEST_CATALOG,
    });

    expect(res.method).toBe("ocr_pdf");
    expect(res.metadata.subjectCode).toBe("CS555");
    expect(res.metadata.subjectName).toBe("Graph Neural Networks");
    expect(res.metadata.branchId).toBe("b-csd");
    expect(res.metadata.examType).toBe("MID_2");
    expect(res.metadata.examMonth).toBe(4);
    expect(res.metadata.examYear).toBe(2025);
    expect(mockTerminate).toHaveBeenCalledTimes(1);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it("recognizes .heic/.heif mobile images, clones bytes into memory, and recovers from createImageBitmap orientation errors", async () => {
    const { cloneFileIntoMemory } = await import("@/lib/browserPaperTools");

    expect(isImageFile(new File(["h"], "camera.HEIC", { type: "" }))).toBe(true);
    expect(isImageFile(new File(["h"], "camera.heif", { type: "" }))).toBe(true);

    const original = new File(["hello-bytes"], "", { type: "" });
    const cloned = await cloneFileIntoMemory(
      original,
      "camera-fallback.jpg",
      "image/jpeg"
    );
    expect(cloned.name).toBe("camera-fallback.jpg");
    expect(cloned.type).toBe("image/jpeg");
    expect(await cloned.text()).toBe("hello-bytes");

    installMockCanvasEnvironment();
    const bitmapMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("InvalidStateError: orientation unsupported"))
      .mockResolvedValueOnce({ width: 1200, height: 1600, close: vi.fn() });
    vi.stubGlobal("createImageBitmap", bitmapMock);

    const firstOut = await convertImagesToPdf([
      new File(["x"], "first-snap.jpg", { type: "image/jpeg" }),
    ]);
    expect(firstOut.pageCount).toBe(1);
    expect(bitmapMock).toHaveBeenCalledTimes(2);

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("decode failed"))
    );
    const revokeSpy = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:camera-fallback"),
      revokeObjectURL: revokeSpy,
    });
    class FallbackImage {
      naturalWidth = 900;
      naturalHeight = 1200;
      width = 900;
      height = 1200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", FallbackImage);

    const secondOut = await convertImagesToPdf([
      new File(["y"], "second-snap.jpg", { type: "image/jpeg" }),
    ]);
    expect(secondOut.pageCount).toBe(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:camera-fallback");
  });
});

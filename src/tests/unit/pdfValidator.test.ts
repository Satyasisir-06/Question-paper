import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { MAX_PDF_BYTES, validatePdfBuffer } from "@/server/validators/pdfValidator";

async function makeValidPdfBytes(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([595, 842]);
  }
  return doc.save();
}

describe("pdfValidator", () => {
  it("accepts a real PDF buffer and extracts page count & sha256 hash", async () => {
    const bytes = await makeValidPdfBytes(3);
    const result = await validatePdfBuffer(bytes, "application/pdf");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.pageCount).toBe(3);
      expect(result.sizeBytes).toBe(bytes.byteLength);
      expect(result.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("rejects empty files", async () => {
    const result = await validatePdfBuffer(new Uint8Array(0), "application/pdf");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/empty/i);
    }
  });

  it("rejects disguised executables or HTML files even with application/pdf MIME", async () => {
    const htmlBytes = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const res1 = await validatePdfBuffer(htmlBytes, "application/pdf");
    expect(res1.valid).toBe(false);

    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // MZ header
    const res2 = await validatePdfBuffer(exeBytes, "application/pdf");
    expect(res2.valid).toBe(false);
  });

  it("rejects corrupted payload that starts with %PDF- magic bytes", async () => {
    const fakePdf = new TextEncoder().encode("%PDF-1.7\nnot-a-real-pdf-trailer");
    const res = await validatePdfBuffer(fakePdf, "application/pdf");
    expect(res.valid).toBe(false);
  });

  it("rejects files exceeding 4 MB limit", async () => {
    const oversized = new Uint8Array(MAX_PDF_BYTES + 1);
    oversized.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const res = await validatePdfBuffer(oversized, "application/pdf");
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.message).toMatch(/4 MB/i);
    }
  });
});

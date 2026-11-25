import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";

export const MAX_PDF_MB = 4;
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024; // 4 MB (Vercel serverless safe)
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export type PdfValidationResult =
  | {
      valid: true;
      pageCount: number;
      sizeBytes: number;
      sha256Hash: string;
    }
  | {
      valid: false;
      code: string;
      message: string;
    };

/** Check leading %PDF- magic bytes independent of file extension or MIME header. */
export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((expected, idx) => bytes[idx] === expected);
}

/** Compute deterministic SHA-256 hex digest for duplicate detection. */
export function computeSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Validate uploaded buffer size, MIME type, %PDF- magic bytes, and structural PDF validity. */
export async function validatePdfBuffer(
  bytes: Uint8Array,
  mimeType?: string
): Promise<PdfValidationResult> {
  if (bytes.byteLength === 0) {
    return {
      valid: false,
      code: "EMPTY_FILE",
      message: "Upload failed. The selected file is empty.",
    };
  }

  if (bytes.byteLength > MAX_PDF_BYTES) {
    return {
      valid: false,
      code: "FILE_TOO_LARGE",
      message: `Upload failed. File exceeds the ${MAX_PDF_MB} MB limit.`,
    };
  }

  if (
    mimeType &&
    mimeType !== "application/pdf" &&
    mimeType !== "application/octet-stream"
  ) {
    return {
      valid: false,
      code: "INVALID_MIME",
      message: "Upload failed. Only PDF documents are accepted.",
    };
  }

  if (!hasPdfMagicBytes(bytes)) {
    return {
      valid: false,
      code: "INVALID_PDF_HEADER",
      message: "Upload failed. File does not have a valid PDF signature.",
    };
  }

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pageCount = doc.getPageCount();
    if (pageCount < 1) {
      return {
        valid: false,
        code: "NO_PAGES",
        message: "Upload failed. The PDF document contains zero pages.",
      };
    }

    return {
      valid: true,
      pageCount,
      sizeBytes: bytes.byteLength,
      sha256Hash: computeSha256(bytes),
    };
  } catch {
    return {
      valid: false,
      code: "CORRUPT_PDF",
      message: "Upload failed. The PDF appears corrupted or encrypted.",
    };
  }
}

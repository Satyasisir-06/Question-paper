export interface ParsedApiResult<T> {
  ok: boolean;
  data: T | null;
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
  errorMessage: string;
}

interface ApiJsonShape<T> {
  success?: boolean;
  data?: T | null;
  error?: { message?: string };
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
}

function parseEnvelopeText<T>(
  raw: string,
  status: number,
  okStatus: boolean,
  fallbackError: string
): ParsedApiResult<T> {
  let parsed: ApiJsonShape<T> | null = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiJsonShape<T>;
    } catch {
      parsed = null;
    }
  }

  if (!okStatus || !parsed?.success) {
    const serverMessage = parsed?.error?.message?.trim();
    return {
      ok: false,
      data: null,
      errorMessage:
        serverMessage ||
        `${fallbackError} (HTTP ${status}). Check Vercel Environment Variables or /api/v1/health.`,
    };
  }

  return {
    ok: true,
    data: (parsed.data ?? null) as T | null,
    meta: parsed.meta,
    errorMessage: "",
  };
}

/**
 * Safely parse an API JSON envelope without throwing SyntaxError on plain-text or
 * HTML HTTP 500/502 error pages from serverless platforms.
 */
export async function safeReadApiJson<T>(
  res: Response,
  fallbackError: string
): Promise<ParsedApiResult<T>> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    return {
      ok: false,
      data: null,
      errorMessage: `${fallbackError} (HTTP ${res.status}).`,
    };
  }

  return parseEnvelopeText<T>(raw, res.status, res.ok, fallbackError);
}

/**
 * Upload a FormData payload with live byte progress reporting while returning a
 * cleanly parsed API envelope.
 */
export function uploadFormWithProgress<T>(
  url: string,
  formData: FormData,
  fallbackError: string,
  onProgress?: (percent: number) => void
): Promise<ParsedApiResult<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress?.(pct);
      }
    };

    xhr.onload = () => {
      resolve(
        parseEnvelopeText<T>(
          xhr.responseText || "",
          xhr.status,
          xhr.status >= 200 && xhr.status < 300,
          fallbackError
        )
      );
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading file."));
    };

    xhr.onabort = () => {
      reject(new Error("Upload was cancelled."));
    };

    xhr.send(formData);
  });
}

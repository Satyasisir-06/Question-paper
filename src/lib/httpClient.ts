export interface ParsedApiResult<T> {
  ok: boolean;
  data: T | null;
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
  errorMessage: string;
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

  interface ApiJsonShape {
    success?: boolean;
    data?: T | null;
    error?: { message?: string };
    meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
  }

  let parsed: ApiJsonShape | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiJsonShape;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok || !parsed?.success) {
    const serverMessage = parsed?.error?.message?.trim();
    return {
      ok: false,
      data: null,
      errorMessage:
        serverMessage ||
        `${fallbackError} (HTTP ${res.status}). Check Vercel Environment Variables or /api/v1/health.`,
    };
  }

  return {
    ok: true,
    data: (parsed.data ?? null) as T | null,
    meta: parsed.meta,
    errorMessage: "",
  };
}

/** Strip whitespace and matching outer single or double quotes from an env variable. */
export function cleanEnvValue(value?: string): string {
  const trimmed = value?.trim() ?? "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Resolve configured database URL across standard DATABASE_URL and Vercel Postgres /
 * Supabase Marketplace environment variable names.
 */
export function resolveDatabaseUrl(): string {
  return (
    cleanEnvValue(process.env.DATABASE_URL) ||
    cleanEnvValue(process.env.POSTGRES_URL) ||
    cleanEnvValue(process.env.POSTGRES_PRISMA_URL) ||
    cleanEnvValue(process.env.POSTGRES_URL_NON_POOLING)
  );
}

/** Redact PostgreSQL credentials before logging or rendering error details. */
export function sanitizeConnectionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw || "Unknown server error";
  return msg.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[REDACTED_DATABASE_URL]");
}

/** Format unexpected server/React boundary errors for safe display in error UIs. */
export function formatUiServerError(error: unknown, fallback: string): string {
  const sanitized = sanitizeConnectionError(error);
  if (
    sanitized === "Unknown server error" ||
    /minified react error|server components render/i.test(sanitized)
  ) {
    return fallback;
  }
  return sanitized;
}

/** Extract Next.js server error digest string if attached. */
export function extractErrorDigest(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
  ) {
    return (error as { digest: string }).digest;
  }
  return undefined;
}


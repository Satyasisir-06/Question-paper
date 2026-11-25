"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const safeMessage =
    error.message && !/postgres(?:ql)?:\/\//i.test(error.message)
      ? error.message
      : "Unable to load this page due to a server configuration or connection error.";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="max-w-md w-full rounded-2xl p-6 space-y-4 text-center"
        style={{
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h1 className="heading-6 text-[var(--text-primary)]">
          Service temporarily unavailable
        </h1>
        <p className="body-6 text-[var(--text-secondary)]">{safeMessage}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="h-9 px-4 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] cursor-pointer"
          >
            Try again
          </button>
          <Link
            href="/api/v1/health"
            className="inline-flex items-center h-9 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)]"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            Check health
          </Link>
        </div>
      </div>
    </div>
  );
}

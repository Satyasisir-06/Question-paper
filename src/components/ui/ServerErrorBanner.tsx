import Link from "next/link";

interface ServerErrorBannerProps {
  title?: string;
  message: string;
}

/** Consistent accessible error alert for dynamic Server Components when DB is unreachable. */
export function ServerErrorBanner({
  title = "Database unavailable",
  message,
}: ServerErrorBannerProps) {
  return (
    <div
      role="alert"
      className="max-w-2xl mx-auto rounded-2xl p-6 space-y-3"
      style={{
        backgroundColor: "var(--badge-rejected-bg)",
        color: "var(--badge-rejected-text)",
        border: "1px solid var(--badge-rejected-border)",
      }}
    >
      <p className="title-3">{title}</p>
      <p className="body-6">{message}</p>
      <div className="pt-1 flex flex-wrap gap-2">
        <Link
          href="/api/v1/health"
          className="inline-flex items-center h-9 px-3 rounded-lg button-sm bg-[var(--surface-primary)] text-[var(--text-primary)]"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          Check health
        </Link>
        <Link
          href="/"
          className="inline-flex items-center h-9 px-3 rounded-lg button-sm bg-[var(--surface-primary)] text-[var(--text-primary)]"
          style={{ border: "1px solid var(--border-primary)" }}
        >
          Back to archive
        </Link>
      </div>
    </div>
  );
}

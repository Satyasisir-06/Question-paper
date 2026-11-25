import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main
        id="main-content"
        className="flex-1 flex items-center justify-center px-6 py-16"
      >
        <div
          className="max-w-md w-full rounded-2xl p-6 text-center space-y-4"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p className="font-mono caption-4 text-[var(--text-muted)]">404</p>
          <h1 className="heading-6 text-[var(--text-primary)]">
            Question paper page not found
          </h1>
          <p className="body-6 text-[var(--text-secondary)]">
            The paper may still be waiting for admin approval or the link has moved.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg px-3 py-2 button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              Browse archive
            </Link>
            <Link
              href="/track"
              className="inline-flex items-center justify-center rounded-lg px-3 py-2 button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 active:scale-[0.98] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              Track submission
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

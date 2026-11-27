"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKey } from "@phosphor-icons/react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { safeReadApiJson } from "@/lib/httpClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const parsed = await safeReadApiJson(res, "Invalid email or password.");
      if (!parsed.ok) {
        setErrorMsg(parsed.errorMessage);
        return;
      }
      router.push("/admin/queue");
      router.refresh();
    } catch {
      setErrorMsg("Unable to reach sign-in endpoint. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main
        id="main-content"
        className="flex-1 flex items-center justify-center px-4 pt-8 pb-28 md:py-12"
      >
        <div className="w-full max-w-md bezel-shell">
          <form
            onSubmit={handleSubmit}
            className="bezel-core p-6 sm:p-7 space-y-5"
          >
            <div className="space-y-1.5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--surface-raised)] text-[var(--action-primary)] mb-3"
                style={{ border: "1px solid var(--border-primary)" }}
              >
                <LockKey size={20} weight="regular" />
              </div>
              <p className="font-mono text-[11px] text-[var(--text-muted)]">
                EXAMINATION CELL ACCESS
              </p>
              <h1 className="heading-4 sm:heading-6 text-[var(--text-primary)]">
                Admin portal sign in
              </h1>
              <p className="body-6 text-[var(--text-secondary)]">
                Review pending student uploads and manage the B.Tech paper catalog.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block title-4 text-[var(--text-primary)] mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@college.edu"
                  className="w-full h-11 px-3 rounded-xl text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                  style={{ border: "1px solid var(--border-primary)" }}
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block title-4 text-[var(--text-primary)] mb-1.5"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-11 px-3 rounded-xl text-base sm:text-sm bg-[var(--surface-raised)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                  style={{ border: "1px solid var(--border-primary)" }}
                />
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl p-3 body-6"
                style={{
                  backgroundColor: "var(--badge-rejected-bg)",
                  color: "var(--badge-rejected-text)",
                  border: "1px solid var(--badge-rejected-border)",
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 sm:h-11 rounded-xl button-sm text-white bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] active:scale-[0.98] disabled:opacity-60 transition-[background-color,transform] duration-200 cursor-pointer"
            >
              {loading ? "Signing in" : "Sign in to admin console"}
            </button>

            <p className="caption-5 text-[var(--text-muted)] text-center">
              Looking to browse papers?{" "}
              <Link href="/" className="text-[var(--action-primary)] hover:underline">
                Return to student archive
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

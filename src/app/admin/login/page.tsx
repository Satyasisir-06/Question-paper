"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKey } from "@phosphor-icons/react";
import { SiteHeader } from "@/components/layout/SiteHeader";

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
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message ?? "Invalid email or password.");
        return;
      }
      router.push("/admin/queue");
      router.refresh();
    } catch {
      setErrorMsg("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main
        id="main-content"
        className="flex-1 flex items-center justify-center px-4 py-12"
      >
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl p-6 space-y-5"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="space-y-1">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--surface-raised)] text-[#2563EB] mb-3">
              <LockKey size={20} weight="regular" />
            </div>
            <h1 className="heading-6 text-[var(--text-primary)]">
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
                className="w-full h-10 px-3 rounded-lg body-6 bg-[var(--surface-raised)] text-[var(--text-primary)]"
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
                className="w-full h-10 px-3 rounded-lg body-6 bg-[var(--surface-raised)] text-[var(--text-primary)]"
                style={{ border: "1px solid var(--border-primary)" }}
              />
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg p-3 body-6"
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
            className="w-full h-10 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-60 transition-[background-color,transform] duration-200 cursor-pointer"
          >
            {loading ? "Signing in" : "Sign in to admin console"}
          </button>

          <p className="caption-5 text-[var(--text-muted)] text-center">
            Looking to browse papers?{" "}
            <Link href="/" className="text-[#2563EB] hover:underline">
              Return to student archive
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

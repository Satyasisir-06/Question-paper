"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Books,
  ChartBar,
  FolderSimple,
  ListChecks,
  SignOut,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AdminNav({ adminName }: { adminName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<{ from: string; to: string } | null>(null);

  const handleSignOut = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const links = [
    { href: "/admin", label: "Overview", mobileLabel: "Overview", icon: ChartBar },
    { href: "/admin/queue", label: "Moderation queue", mobileLabel: "Queue", icon: ListChecks },
    { href: "/admin/catalog", label: "Catalog & upload", mobileLabel: "Catalog", icon: FolderSimple },
  ];

  const optimisticPath =
    pendingTarget && pendingTarget.from === pathname ? pendingTarget.to : pathname;
  const activeMobileIndex = Math.max(
    0,
    links.findIndex((item) => optimisticPath === item.href)
  );

  return (
    <>
      <header
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{
          backgroundColor: "color-mix(in srgb, var(--surface-primary) 90%, transparent)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div className="max-w-[1440px] mx-auto h-14 md:h-16 px-3.5 md:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/admin" className="flex items-center gap-2.5 shrink-0 min-w-0">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--action-primary)] text-white shrink-0 shadow-xs">
                <Books size={17} weight="regular" />
              </span>
              <span className="flex flex-col leading-none min-w-0">
                <span className="title-3 text-[var(--text-primary)] truncate">
                  PaperVault Admin
                </span>
                <span className="hidden sm:inline font-mono text-[10px] text-[var(--text-muted)] tracking-wide">
                  MODERATION DESK
                </span>
              </span>
            </Link>

            <nav aria-label="Admin navigation" className="hidden md:flex items-center gap-1">
              {links.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg title-4 transition-colors duration-200 ${
                      active
                        ? "bg-[var(--surface-raised)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon size={16} weight="regular" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {adminName && (
              <span className="hidden lg:inline caption-4 text-[var(--text-muted)]">
                {adminName}
              </span>
            )}
            <Link
              href="/"
              className="h-9 px-2.5 inline-flex items-center rounded-lg caption-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
            >
              <span className="hidden sm:inline">Student archive</span>
              <span className="sm:hidden">Archive</span>
            </Link>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 active:scale-[0.98] transition-transform cursor-pointer"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              <SignOut size={16} weight="regular" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile admin navigation"
        className="md:hidden fixed bottom-3 inset-x-3 z-30 pb-[env(safe-area-inset-bottom)] pointer-events-none"
      >
        <div className="pointer-events-auto max-w-[400px] mx-auto dock-tray h-14 rounded-[20px] p-1 backdrop-blur-xl">
          <div className="relative grid grid-cols-3 h-full">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/3 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--border-primary)]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-2/3 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--border-primary)]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 rounded-[16px] dock-thumb transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translate3d(${activeMobileIndex * 100}%, 0, 0)`,
              }}
            >
              <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-[var(--action-primary)]" />
            </span>

            {links.map((item) => {
              const active = optimisticPath === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setPendingTarget({ from: pathname, to: item.href })}
                  className={`tap-press relative z-10 rounded-[16px] flex items-center justify-center gap-1.5 text-[12.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    active
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon
                    size={16}
                    weight={active ? "fill" : "regular"}
                    className={`transition-colors duration-200 ${
                      active ? "text-[var(--action-primary)]" : ""
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.mobileLabel}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

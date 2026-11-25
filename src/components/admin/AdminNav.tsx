"use client";

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

  const handleSignOut = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const links = [
    { href: "/admin", label: "Overview", icon: ChartBar },
    { href: "/admin/queue", label: "Moderation queue", icon: ListChecks },
    { href: "/admin/catalog", label: "Catalog & upload", icon: FolderSimple },
  ];

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in srgb, var(--surface-primary) 90%, transparent)",
        borderBottom: "1px solid var(--border-primary)",
      }}
    >
      <div className="max-w-[1440px] mx-auto h-16 px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2563EB] text-white">
              <Books size={18} weight="regular" />
            </span>
            <span className="title-3 text-[var(--text-primary)]">
              PaperVault Admin
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

        <div className="flex items-center gap-2 sm:gap-3">
          {adminName && (
            <span className="hidden lg:inline caption-4 text-[var(--text-muted)]">
              {adminName}
            </span>
          )}
          <Link
            href="/"
            className="h-9 px-2.5 inline-flex items-center rounded-lg caption-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Student archive
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg button-sm text-[var(--text-primary)] bg-[var(--surface-raised)] hover:opacity-90 cursor-pointer"
            style={{ border: "1px solid var(--border-primary)" }}
          >
            <SignOut size={16} weight="regular" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      <nav
        aria-label="Mobile admin navigation"
        className="md:hidden px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-t border-[var(--border-primary)]"
      >
        {links.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg caption-4 whitespace-nowrap shrink-0 ${
                active
                  ? "bg-[#2563EB] text-white"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
              }`}
            >
              <Icon size={15} weight="regular" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

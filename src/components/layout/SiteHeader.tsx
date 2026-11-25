"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Books,
  List,
  MagnifyingGlass,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface SiteHeaderProps {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

function HeaderNavItems() {
  const pathname = usePathname();

  return (
    <>
      <Link
        href="/track"
        className={`hidden sm:inline-flex items-center h-9 px-2.5 rounded-lg title-4 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          pathname === "/track"
            ? "text-[var(--text-primary)] bg-[var(--surface-raised)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        Track upload
      </Link>
      <Link
        href="/admin"
        className={`hidden sm:inline-flex items-center h-9 px-2.5 rounded-lg title-4 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          pathname.startsWith("/admin")
            ? "text-[var(--text-primary)] bg-[var(--surface-raised)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        Admin
      </Link>
    </>
  );
}

function HeaderSearchSlot({
  searchQuery,
  onSearchChange,
  searchInputRef,
}: SiteHeaderProps) {
  const pathname = usePathname();
  if (pathname !== "/" || onSearchChange === undefined) {
    return <div className="flex-1" />;
  }

  return (
    <div className="hidden md:flex flex-1 max-w-md items-center relative">
      <MagnifyingGlass
        size={16}
        weight="regular"
        className="absolute left-3 text-[var(--text-muted)] pointer-events-none"
      />
      <input
        ref={searchInputRef}
        type="search"
        value={searchQuery ?? ""}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search subject code or name"
        aria-label="Search subject code or name"
        className="w-full h-9 pl-9 pr-14 rounded-lg body-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        style={{ border: "1px solid var(--border-primary)" }}
      />
      <kbd className="absolute right-2.5 px-1.5 py-0.5 rounded font-mono caption-5 text-[var(--text-muted)] bg-[var(--surface-primary)] border border-[var(--border-primary)] pointer-events-none">
        Ctrl K
      </kbd>
    </div>
  );
}

function MobileMenuDrawer({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Browse question papers" },
    { href: "/upload", label: "Upload question paper" },
    { href: "/track", label: "Track upload status" },
    { href: "/admin", label: "Admin portal" },
  ];

  return (
    <div
      className="fixed inset-x-0 top-16 bottom-0 z-40 sm:hidden p-4 overflow-y-auto backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in srgb, var(--surface-primary) 96%, transparent)",
        borderTop: "1px solid var(--border-primary)",
      }}
    >
      <nav aria-label="Mobile navigation" className="space-y-1.5">
        {links.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center h-12 px-4 rounded-xl title-3 transition-colors duration-200 ${
                active
                  ? "bg-[#2563EB] text-white"
                  : "bg-[var(--surface-raised)] text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SiteHeader({
  searchQuery,
  onSearchChange,
  searchInputRef,
}: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header
        className="sticky top-0 z-30 h-16 backdrop-blur-md transition-colors duration-200"
        style={{
          backgroundColor: "color-mix(in srgb, var(--surface-primary) 88%, transparent)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2563EB] text-white"
              aria-hidden="true"
            >
              <Books size={18} weight="regular" />
            </span>
            <span className="title-3 text-[var(--text-primary)] tracking-tight">
              B.Tech PaperVault
            </span>
          </Link>

          <Suspense fallback={<div className="flex-1" />}>
            <HeaderSearchSlot
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              searchInputRef={searchInputRef}
            />
          </Suspense>

          <nav aria-label="Primary navigation" className="flex items-center gap-1.5 sm:gap-3">
            <Suspense
              fallback={
                <>
                  <Link
                    href="/track"
                    className="hidden sm:inline-flex items-center h-9 px-2.5 rounded-lg title-4 text-[var(--text-secondary)]"
                  >
                    Track upload
                  </Link>
                  <Link
                    href="/admin"
                    className="hidden sm:inline-flex items-center h-9 px-2.5 rounded-lg title-4 text-[var(--text-secondary)]"
                  >
                    Admin
                  </Link>
                </>
              }
            >
              <HeaderNavItems />
            </Suspense>

            <ThemeToggle />

            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 h-10 sm:h-9 px-3 rounded-lg button-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              <UploadSimple size={16} weight="regular" />
              <span className="hidden xs:inline sm:inline">Upload paper</span>
              <span className="xs:hidden sm:hidden">Upload</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-[var(--text-primary)] bg-[var(--surface-raised)]"
              style={{ border: "1px solid var(--border-primary)" }}
            >
              {mobileMenuOpen ? <X size={18} weight="regular" /> : <List size={18} weight="regular" />}
            </button>
          </nav>
        </div>
      </header>

      {mobileMenuOpen && (
        <Suspense fallback={null}>
          <MobileMenuDrawer onClose={() => setMobileMenuOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

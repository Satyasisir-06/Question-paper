"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Books, ClockCounterClockwise, UploadSimple } from "@phosphor-icons/react";

export function MobileBottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const isArchive = pathname === "/" || pathname.startsWith("/papers/");
  const isTrack = pathname.startsWith("/track");
  const isUpload = pathname.startsWith("/upload");
  const activeIndex = isArchive ? 0 : isTrack ? 1 : -1;

  const readingTabs = [
    {
      href: "/",
      label: "Archive",
      ariaLabel: "Browse archive bottom tab",
      active: isArchive,
      icon: Books,
    },
    {
      href: "/track",
      label: "Track",
      ariaLabel: "Track submission bottom tab",
      active: isTrack,
      icon: ClockCounterClockwise,
    },
  ];

  return (
    <nav
      aria-label="Mobile thumb navigation"
      className="md:hidden fixed bottom-3 inset-x-3 z-30 pb-[env(safe-area-inset-bottom)] pointer-events-none"
    >
      <div className="pointer-events-auto max-w-[400px] mx-auto flex items-center gap-2">
        <div className="flex-1 min-w-0 dock-tray h-14 rounded-[20px] p-1 backdrop-blur-xl">
          <div className="relative grid grid-cols-2 h-full">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-4 bg-[var(--border-primary)]"
            />
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-[16px] dock-thumb transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                activeIndex >= 0 ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
              style={{
                transform: `translate3d(${activeIndex === 1 ? "100%" : "0%"}, 0, 0)`,
              }}
            >
              <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-[var(--action-primary)]" />
            </span>

            {readingTabs.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.ariaLabel}
                  className={`tap-press relative z-10 flex items-center justify-center gap-2 rounded-[16px] text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    item.active
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon
                    size={17}
                    weight={item.active ? "fill" : "regular"}
                    className={`transition-colors duration-200 ${
                      item.active ? "text-[var(--action-primary)]" : ""
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <Link
          href="/upload"
          aria-label="Upload paper bottom tab"
          className={`group tap-press shrink-0 h-14 rounded-[20px] pl-2 pr-4 flex items-center gap-2.5 text-[13px] font-medium transition-[transform,background-color,color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
            isUpload ? "dock-action-key-active" : "dock-action-key"
          }`}
        >
          <span
            aria-hidden="true"
            className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              backgroundColor: isUpload
                ? "rgba(255, 255, 255, 0.16)"
                : "color-mix(in srgb, currentColor 11%, transparent)",
              border: isUpload
                ? "1px solid rgba(255, 255, 255, 0.22)"
                : "1px solid color-mix(in srgb, currentColor 14%, transparent)",
            }}
          >
            <UploadSimple
              size={17}
              weight={isUpload ? "bold" : "regular"}
              className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-active:-translate-y-0.5"
            />
          </span>
          <span className="whitespace-nowrap">Upload</span>
        </Link>
      </div>
    </nav>
  );
}

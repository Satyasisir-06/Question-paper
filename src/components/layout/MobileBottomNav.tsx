"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Books, ClockCounterClockwise, UploadSimple } from "@phosphor-icons/react";

export function MobileBottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const items = [
    {
      href: "/",
      label: "Archive",
      ariaLabel: "Browse archive bottom tab",
      active: pathname === "/" || pathname.startsWith("/papers/"),
      icon: Books,
    },
    {
      href: "/upload",
      label: "Upload",
      ariaLabel: "Upload paper bottom tab",
      active: pathname.startsWith("/upload"),
      icon: UploadSimple,
    },
    {
      href: "/track",
      label: "Track",
      ariaLabel: "Track submission bottom tab",
      active: pathname.startsWith("/track"),
      icon: ClockCounterClockwise,
    },
  ];

  return (
    <nav
      aria-label="Mobile thumb navigation"
      className="md:hidden fixed bottom-3 inset-x-3 z-30 pb-[env(safe-area-inset-bottom)] pointer-events-none"
    >
      <div
        className="pointer-events-auto max-w-md mx-auto rounded-2xl p-1.5 grid grid-cols-3 gap-1 backdrop-blur-xl"
        style={{
          backgroundColor: "color-mix(in srgb, var(--surface-primary) 90%, transparent)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.ariaLabel}
              className={`h-11 rounded-xl flex items-center justify-center gap-1.5 caption-4 transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] ${
                item.active
                  ? "bg-[var(--action-primary)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              <Icon size={17} weight={item.active ? "fill" : "regular"} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

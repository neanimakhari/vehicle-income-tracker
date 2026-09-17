"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navigation } from "./navigation";
import { ThemeToggle } from "./theme-toggle";
import { Menu, X } from "lucide-react";

export function MobileSidebarWrapper({
  tenantName,
  entitlements,
}: {
  tenantName: string | null;
  entitlements?: string[] | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-r border-zinc-800 shadow-2xl transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b border-zinc-800">
          <Link href="/" className="flex items-center gap-3 group min-w-0 flex-1" onClick={() => setIsOpen(false)}>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg group-hover:shadow-teal-500/50 transition-all group-hover:scale-105 overflow-hidden flex-shrink-0">
              <Image
                src="/vit-logo.png"
                alt="VIT Logo"
                width={40}
                height={40}
                className="object-contain p-1"
                priority
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold text-white truncate">
                {tenantName || "VIT Tenant"}
              </div>
              <div className="text-xs text-teal-400 font-medium">Admin Console</div>
            </div>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-zinc-400 hover:text-white transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Navigation onLinkClick={() => setIsOpen(false)} entitlements={entitlements} />
        </div>
        <div className="shrink-0 p-4 border-t border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-400">Theme</div>
            <ThemeToggle />
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
          </div>
        </div>
      </aside>
      {/* Menu button sits in the header row area; header has pl-14 so title clears it */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm shadow-md border border-zinc-200/60 dark:border-zinc-700/60"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
}

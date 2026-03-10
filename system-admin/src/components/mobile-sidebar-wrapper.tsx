"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navigation } from "./navigation";
import { ThemeToggle } from "./theme-toggle";
import { X } from "lucide-react";

export function MobileSidebarWrapper() {
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
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-r border-zinc-800 shadow-2xl transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6 border-b border-zinc-800">
          <Link href="/" className="flex items-center gap-3 group w-full" onClick={() => setIsOpen(false)}>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg group-hover:shadow-teal-500/50 transition-all group-hover:scale-105 overflow-hidden flex-shrink-0">
              <Image
                src="/vit-logo.png"
                alt="VIT Logo"
                width={48}
                height={48}
                className="object-contain p-1"
                priority
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-white truncate">
                VIT Platform
              </div>
              <div className="text-xs text-teal-400 font-medium">System Control</div>
            </div>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <Navigation onLinkClick={() => setIsOpen(false)} />
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-400">Theme</div>
            <ThemeToggle />
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}
          </div>
        </div>
      </aside>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-teal-600 text-white text-xs font-medium shadow-lg shadow-teal-700/40 active:scale-95 transition-transform"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="hidden xs:inline">Menu</span>
      </button>
    </>
  );
}


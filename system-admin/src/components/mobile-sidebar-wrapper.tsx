"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navigation } from "./navigation";
import { ThemeToggle } from "./theme-toggle";
import { LogOut, X } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";

export function MobileSidebarWrapper({ role }: { role?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isSys = role === "SYS";

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
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
              <div className="text-base font-bold text-white truncate">VIT Platform</div>
              <div className="text-xs text-teal-400 font-medium">
                {isSys ? "SYS Support" : "System Control"}
              </div>
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
          <Navigation role={role} onLinkClick={() => setIsOpen(false)} />
        </div>
        <div className="shrink-0 space-y-3 border-t border-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-400">Theme</div>
            <ThemeToggle />
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </form>
          <div className="font-mono text-xs text-zinc-500">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
          </div>
        </div>
      </aside>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 left-3 z-[60] inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-teal-600 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-teal-700/40 transition-transform active:scale-95 lg:hidden"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="hidden sm:inline">Menu</span>
      </button>
    </>
  );
}

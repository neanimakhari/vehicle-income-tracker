"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navigation } from "./navigation";
import { ThemeToggle } from "./theme-toggle";
import { LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";

export function MobileSidebarWrapper({
  tenantName,
  entitlements,
  logoSrc = "/vit-logo.png",
}: {
  tenantName: string | null;
  entitlements?: string[] | null;
  logoSrc?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 shadow-2xl transition-transform duration-300 lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-4">
          <Link
            href="/"
            className="group flex min-w-0 flex-1 items-center gap-3"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-sm transition-all group-hover:scale-105 group-hover:shadow-teal-500/50">
              {logoSrc.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt=""
                  width={40}
                  height={40}
                  className="object-contain p-1 h-10 w-10"
                />
              ) : (
                <Image
                  src={logoSrc}
                  alt="Logo"
                  width={40}
                  height={40}
                  className="object-contain p-1"
                  priority
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold text-white">
                {tenantName || "VIT Tenant"}
              </div>
              <div
                className="text-xs font-medium text-zinc-400"
                style={{
                  color: "var(--brand-on-dark, var(--brand-accent, #a1a1aa))",
                }}
              >
                Admin Console
              </div>
            </div>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="shrink-0 p-2 text-zinc-400 transition-colors hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="sidebar-scroll flex-1 overflow-y-auto">
          <Navigation onLinkClick={() => setIsOpen(false)} entitlements={entitlements} />
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
        className="fixed top-3 left-3 z-50 flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-200/60 bg-white/90 text-zinc-700 shadow-md backdrop-blur-sm transition-colors hover:bg-zinc-100 lg:hidden dark:border-zinc-700/60 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
}

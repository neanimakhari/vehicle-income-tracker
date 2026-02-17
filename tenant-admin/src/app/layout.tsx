import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { getAuthToken } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { unstable_rethrow } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Navigation } from "@/components/navigation";
import { AuthChecker } from "@/components/auth-checker";
import { MobileSidebarWrapper } from "@/components/mobile-sidebar-wrapper";
import { ToastFromUrl } from "@/components/toast-from-url";
import {
  LogOut,
  Bell,
} from "lucide-react";
import Image from "next/image";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIT Tenant Admin",
  description: "Tenant operations console.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getAuthToken();
  const isAuthenticated = Boolean(token);
  let pendingMfaUsers: number | null = null;
  let tenantName: string | null = null;
  if (isAuthenticated) {
    try {
      const [policy, drivers] = await Promise.all([
        fetchJson<{ requireMfaUsers?: boolean; tenantName?: string }>("/tenant/policy"),
        fetchJson<Array<{ mfaEnabled?: boolean }>>("/tenant/users"),
      ]);
      if (policy?.requireMfaUsers) {
        pendingMfaUsers = (drivers ?? []).filter(driver => !driver.mfaEnabled).length;
      }
      tenantName = policy?.tenantName ?? null;
    } catch (err) {
      unstable_rethrow(err); // allow redirect() from api 401 to propagate
      pendingMfaUsers = null;
      tenantName = null;
    }
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} bg-gradient-to-br from-zinc-100 via-zinc-50 to-teal-50/40 text-zinc-900 antialiased dark:from-zinc-950 dark:via-zinc-900 dark:to-teal-950/20 dark:text-zinc-50`}
      >
        {process.env.NEXT_PUBLIC_USERWAY_ACCOUNT_ID ? (
          <Script
            src="https://cdn.userway.org/widget.js"
            data-account={process.env.NEXT_PUBLIC_USERWAY_ACCOUNT_ID}
            strategy="lazyOnload"
          />
        ) : null}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-teal-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          {isAuthenticated ? (
            <>
              <AuthChecker />
              <MobileSidebarWrapper tenantName={tenantName} />
              <div className="min-h-screen">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-r border-zinc-800 shadow-2xl">
                  <div className="flex h-20 items-center px-6 border-b border-zinc-800">
                    <Link href="/" className="flex items-center gap-3 group w-full">
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
                          {tenantName || "VIT Tenant"}
                        </div>
                        <div className="text-xs text-teal-400 font-medium">Admin Console</div>
                      </div>
                    </Link>
                  </div>
                  <Navigation />
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

                <div className="lg:pl-72">
                  <Suspense fallback={null}>
                    <ToastFromUrl />
                  </Suspense>
                  <header className="sticky top-0 z-30 flex h-16 lg:h-20 items-center gap-x-4 border-b border-zinc-200/80 bg-white/80 backdrop-blur-lg shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/80">
                    <div className="flex flex-1 items-center justify-between px-4 lg:px-8">
                      <div className="flex items-center gap-3">
                        <div className="text-sm sm:text-base lg:text-lg font-semibold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
                          Tenant Administration
                        </div>
                      </div>
                      <div className="flex items-center gap-2 lg:gap-4">
                        {pendingMfaUsers !== null && pendingMfaUsers > 0 ? (
                          <div className="hidden sm:flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 lg:px-4 py-1.5 lg:py-2 text-xs font-semibold text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                            <Bell className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                            <span className="hidden lg:inline">Driver MFA pending: {pendingMfaUsers}</span>
                            <span className="lg:hidden">{pendingMfaUsers}</span>
                          </div>
                        ) : null}
                        <div className="hidden sm:flex items-center gap-2 lg:gap-3">
                          <div className="h-8 w-8 lg:h-9 lg:w-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-xs lg:text-sm font-semibold shadow-md">
                            A
                          </div>
                          <div className="hidden lg:flex flex-col">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Admin</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Tenant Admin</span>
                          </div>
                        </div>
                        <form action={logoutAction}>
                          <button
                            type="submit"
                            aria-label="Log out"
                            className="flex items-center gap-1.5 lg:gap-2 rounded-lg border border-zinc-200 bg-white px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-50 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          >
                            <LogOut className="h-3.5 w-3.5 lg:h-4 lg:w-4" aria-hidden />
                            <span className="hidden sm:inline">Logout</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  </header>
                  <main id="main-content" className="px-4 lg:px-8 py-6 lg:py-10" tabIndex={-1}>{children}</main>
                </div>
              </div>
            </>
          ) : (
            <main id="main-content" className="min-h-screen px-6 py-10" tabIndex={-1}>{children}</main>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}


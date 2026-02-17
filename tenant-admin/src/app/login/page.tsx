"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield, ArrowRight, BookmarkCheck } from "lucide-react";
import { loginAction } from "@/lib/auth-actions";
import Link from "next/link";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ error: string; message?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await loginAction(formData);
      if (result?.error) setError(result);
    } catch (e) {
      // Server Action redirect() throws; let it propagate so Next.js can handle navigation
      const err = e as { digest?: string };
      if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) throw e;
      setError({ error: "invalid", message: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayMessage = error?.message ?? (error?.error === "missing" ? "Tenant, email and password are required." : error ? "Login failed." : null);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(13,148,136,0.6) 50%, rgba(0,0,0,0.85) 100%), url('/bg.jpg') center/cover no-repeat",
        backgroundColor: "#0a0a0a",
      }}
    >
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg mb-4">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-teal-200/90">Sign in to your tenant admin account</p>
        </div>

        <div className="bg-zinc-900/95 backdrop-blur rounded-2xl shadow-xl border border-zinc-700 p-8 text-white">
          {displayMessage && (
            <div className="mb-6 rounded-lg border border-red-400/50 bg-red-900/30 px-4 py-3 text-sm text-red-200">
              {displayMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Tenant</label>
              <input
                type="text"
                name="tenantSlug"
                required
                autoComplete="organization"
                className="block w-full pl-3 pr-3 py-3 border border-zinc-600 rounded-lg bg-zinc-800/80 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="e.g. demo or acme"
              />
              <p className="mt-1 text-xs text-zinc-400">Your tenant identifier (slug).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-zinc-600 rounded-lg bg-zinc-800/80 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="admin@tenant.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  className="block w-full pl-10 pr-12 py-3 border border-zinc-600 rounded-lg bg-zinc-800/80 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <input type="hidden" name="rememberMe" value={rememberMe ? "true" : "false"} />
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border-zinc-600 rounded focus:ring-teal-500 bg-zinc-800"
                />
                <BookmarkCheck className="ml-2 h-4 w-4 text-zinc-400" />
                <span className="ml-2 text-sm text-zinc-400">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm font-medium text-teal-400 hover:text-teal-300">
                Forgot password?
              </Link>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowMfa(!showMfa)}
                className="flex items-center justify-between w-full text-sm text-zinc-400 hover:text-zinc-200"
              >
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  MFA Code (if enabled)
                </span>
                <span className="text-xs">{showMfa ? "Hide" : "Show"}</span>
              </button>
              {showMfa && (
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    type="text"
                    name="mfaToken"
                    className="block w-full pl-10 pr-3 py-3 border border-zinc-600 rounded-lg bg-zinc-800/80 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="123456"
                    maxLength={6}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-700 flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-400">
            <Link href="/privacy" className="hover:text-teal-400">Privacy Policy</Link>
            <span className="hidden sm:inline">•</span>
            <Link href="/terms" className="hover:text-teal-400">Terms of Service</Link>
            <span className="hidden sm:inline">•</span>
            <Link href="/help" className="hover:text-teal-400">Help & Support</Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-teal-200/80 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          Secure login
        </p>
      </div>
    </div>
  );
}

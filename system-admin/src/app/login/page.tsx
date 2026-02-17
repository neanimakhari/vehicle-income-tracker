"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield, ArrowRight, ChevronDown, ChevronUp, BookmarkCheck } from "lucide-react";
import { loginAction } from "@/lib/auth-actions";
import Image from "next/image";

type LoginPageProps = {
  searchParams?: { error?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const error = searchParams?.error;
  const message =
    error === "missing"
      ? "Email and password are required."
      : error === "mfa-required"
        ? "MFA code required. Enter your authenticator code."
        : error === "mfa-setup"
          ? "MFA setup required. Enable MFA in Security before logging in."
          : error === "expired"
            ? "Your session expired. Please sign in again."
            : error === "forbidden"
              ? "Platform administrator access required. Sign in with platform.admin@vit.local (see README for password)."
              : error
                ? "Login failed. Check your credentials."
                : null;

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    try {
      await loginAction(formData);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 bg-gradient-to-b from-teal-900/30 via-teal-900/10 to-zinc-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white shadow-lg mb-4 border border-zinc-700">
            <Image
              src="/vit-logo.png"
              alt="VIT Logo"
              width={80}
              height={80}
              className="object-contain p-2"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            System Admin Login
          </h1>
          <p className="text-sm text-zinc-600">
            Sign in with your platform admin credentials
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-700 p-8">
          {message && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  placeholder="admin@platform.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  className="block w-full pl-10 pr-12 py-2.5 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border-zinc-300 rounded focus:ring-teal-500"
                />
                <BookmarkCheck className="ml-2 h-4 w-4 text-zinc-500" />
                <span className="ml-2 text-sm text-zinc-600">Remember me</span>
              </label>
              <a
                href="/forgot-password"
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                Forgot password?
              </a>
            </div>

            {/* MFA Field (Collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowMfa(!showMfa)}
                className="flex items-center justify-between w-full text-sm font-medium text-zinc-700 mb-2 hover:text-teal-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  MFA Code (if enabled)
                </span>
                {showMfa ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showMfa && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    type="text"
                    name="mfaToken"
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    placeholder="123456"
                    maxLength={6}
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:from-teal-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

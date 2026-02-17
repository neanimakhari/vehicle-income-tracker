"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getApiUrl } from "@/lib/api-client";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "idle">("idle");
  const [message, setMessage] = useState<string>("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus("error");
      setMessage("Invalid verification link. Please check your email for the correct link.");
    }
  }, [token]);

  async function verifyEmail(verificationToken: string) {
    setStatus("verifying");
    try {
      const tenantId = localStorage.getItem("tenantId") || new URLSearchParams(window.location.search).get("tenant");
      const url = tenantId
        ? `${getApiUrl()}/tenant/auth/verify-email?tenant=${tenantId}`
        : `${getApiUrl()}/tenant/auth/verify-email`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await res.json();
      if (res.ok && data.verified) {
        setStatus("success");
        setMessage("Email verified successfully! You can now log in.");
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        setStatus("error");
        setMessage(data.message || "Verification failed. The link may have expired.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("An error occurred during verification. Please try again.");
    }
  }

  async function resendVerification() {
    setIsResending(true);
    try {
      const email = prompt("Enter your email address:");
      if (!email) {
        setIsResending(false);
        return;
      }

      const tenantId = localStorage.getItem("tenantId") || new URLSearchParams(window.location.search).get("tenant");
      const url = tenantId
        ? `${getApiUrl()}/tenant/auth/resend-verification?tenant=${tenantId}`
        : `${getApiUrl()}/tenant/auth/resend-verification`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || "Verification email sent! Please check your inbox.");
      } else {
        setMessage(data.message || "Failed to resend verification email.");
      }
    } catch (error) {
      setMessage("An error occurred. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-teal-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              status === "success" 
                ? "bg-green-100 dark:bg-green-900/30" 
                : status === "error"
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-teal-100 dark:bg-teal-900/30"
            }`}>
              {status === "verifying" ? (
                <RefreshCw className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin" />
              ) : status === "success" ? (
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              ) : status === "error" ? (
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              ) : (
                <Mail className="w-8 h-8 text-teal-600 dark:text-teal-400" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              {status === "verifying" 
                ? "Verifying Email..." 
                : status === "success"
                ? "Email Verified!"
                : status === "error"
                ? "Verification Failed"
                : "Email Verification"}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {status === "verifying" 
                ? "Please wait while we verify your email address."
                : status === "success"
                ? "Your email has been successfully verified."
                : status === "error"
                ? "We couldn't verify your email address."
                : "Click the link in your email to verify your account."}
            </p>
          </div>

          {message && (
            <div className={`mb-6 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
              status === "success"
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/30 text-green-700 dark:text-green-200"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 text-red-700 dark:text-red-200"
            }`}>
              {status === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {message}
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <button
                onClick={resendVerification}
                disabled={isResending}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Resend Verification Email
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


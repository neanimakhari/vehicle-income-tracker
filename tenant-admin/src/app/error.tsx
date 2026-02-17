"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-zinc-100 via-zinc-50 to-teal-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-teal-950/20">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        An unexpected error occurred. Please try again.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 text-center"
        >
          Go to dashboard
        </Link>
        <Link
          href="/login"
          className="text-sm text-teal-600 dark:text-teal-400 hover:underline text-center"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

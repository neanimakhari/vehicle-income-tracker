"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";

type ResetResult = {
  temporaryPassword?: string;
  email?: string;
  error?: string;
};

type Props = {
  driverId: string;
  driverName: string;
  onReset: (id: string) => Promise<ResetResult>;
};

export function ResetDriverPasswordButton({
  driverId,
  driverName,
  onReset,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ResetResult | null>(null);

  function handleClick() {
    if (
      !window.confirm(
        `Reset password for ${driverName}? They will get a temporary password and must change it on next login.`,
      )
    ) {
      return;
    }
    setResult(null);
    startTransition(async () => {
      const res = await onReset(driverId);
      setResult(res);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md p-2 text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
        title="Reset password"
        aria-label="Reset password"
      >
        <KeyRound className="h-4 w-4" />
        <span className="hidden lg:inline ml-1.5">
          {isPending ? "Resetting…" : "Reset password"}
        </span>
      </button>
      {result?.temporaryPassword ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="temp-password-title"
        >
          <div
            className="absolute inset-0 bg-zinc-900/60"
            onClick={() => setResult(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3
              id="temp-password-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Temporary password set
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Share this with <strong>{result.email ?? driverName}</strong>. They
              must change it on next login.
            </p>
            <code className="mt-4 block break-all rounded-lg bg-zinc-100 px-3 py-2 text-sm font-mono text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
              {result.temporaryPassword}
            </code>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              onClick={() => {
                void navigator.clipboard?.writeText(result.temporaryPassword!);
                setResult(null);
              }}
            >
              Copy and close
            </button>
          </div>
        </div>
      ) : null}
      {result?.error ? (
        <span className="sr-only" role="alert">
          {result.error}
        </span>
      ) : null}
      {result?.error ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {result.error}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setResult(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

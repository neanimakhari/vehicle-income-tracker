"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

/**
 * Reads ?success= or ?error= (or ?cleared=1) from the URL and shows a toast.
 * Clears the param after 5s or when dismissed.
 */
export function ToastFromUrl() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const cleared = searchParams.get("cleared");

  const message = success ?? error ?? (cleared ? "Cache cleared. The next page load will use fresh data." : null);
  const isSuccess = Boolean(success || cleared);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(clearAndHide, 5000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clearAndHide uses router/searchParams, we only want to run when message/pathname changes
  }, [message, pathname]);

  function clearAndHide() {
    setVisible(false);
    const next = new URLSearchParams(searchParams);
    next.delete("success");
    next.delete("error");
    next.delete("cleared");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  if (!visible || !message) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] max-w-md animate-in fade-in slide-in-from-top-2 duration-300"
      role="alert"
    >
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
          isSuccess
            ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100"
            : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100"
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
        )}
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={clearAndHide}
          className="rounded p-1 hover:opacity-80"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

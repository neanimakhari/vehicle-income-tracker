import Link from "next/link";
import { DeletionRequestForm } from "./DeletionRequestForm";

export default function DeletionRequestPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/privacy"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-6"
      >
        ← Back to Privacy Policy
      </Link>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Data deletion request
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Under POPIA you may request deletion of personal information Vehinc holds about you in
          VIT. We aim to respond within 30 days. Some records may be retained where the law or a
          fleet contract requires it.
        </p>
        <div className="mt-6">
          <DeletionRequestForm />
        </div>
      </div>
    </div>
  );
}

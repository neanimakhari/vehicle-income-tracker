import { clearPlatformAdminCache } from "../actions/clear-cache";

type CacheClearSectionProps = {
  clearAction: () => Promise<never>;
  showCleared: boolean;
};

export function CacheClearSection({ clearAction, showCleared }: CacheClearSectionProps) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Cache</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Clear Next.js caches so the next load fetches fresh data. Use after config or data changes.
      </p>
      {showCleared && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          Cache cleared. The next page load will use fresh data.
        </div>
      )}
      <form action={clearAction}>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          Clear platform admin cache
        </button>
      </form>
      <div className="mt-4 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <p>
          <strong>Cron / external:</strong> POST <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">/api/revalidate?secret=YOUR_SECRET</code> (use your app origin as base URL).
        </p>
        <p>
          Set <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">REVALIDATE_SECRET</code> in .env to protect the endpoint; if unset, revalidate is allowed without a secret.
        </p>
      </div>
    </div>
  );
}

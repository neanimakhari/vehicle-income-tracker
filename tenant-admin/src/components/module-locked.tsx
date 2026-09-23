import { Lock } from "lucide-react";

export function ModuleLocked({
  title,
  moduleKey,
  detail,
}: {
  title: string;
  moduleKey?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-8 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {detail ??
              "This module is not included in your plan. Contact Vehinc support to upgrade."}
          </p>
          {moduleKey ? (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
              Module: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{moduleKey}</code>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

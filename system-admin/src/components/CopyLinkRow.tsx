"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLinkRow({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 break-all font-mono text-xs text-teal-700 hover:underline dark:text-teal-400"
        >
          {url}
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          title="Copy link"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

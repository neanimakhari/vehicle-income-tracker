"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";

export function SmtpTestSection({
  configured,
  transport,
  from,
  sendTest,
}: {
  configured: boolean;
  transport: string;
  from: string;
  sendTest: (to: string) => Promise<{ ok: boolean; error?: string; sent?: boolean }>;
}) {
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <Mail className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Outbound email</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {configured
              ? `Configured (${transport}) · from ${from}`
              : "Not configured — set Mailgun or SMTP env vars"}
          </p>
        </div>
      </div>
      {configured && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            setErr(null);
            start(async () => {
              const res = await sendTest(to.trim());
              if (!res.ok) {
                setErr(res.error ?? "Send failed");
                return;
              }
              setMsg(res.sent ? `Test email sent to ${to.trim()}` : "Send returned sent=false");
            });
          }}
        >
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Send test to
            </label>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input w-full px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send test"}
          </button>
        </form>
      )}
      {msg && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}

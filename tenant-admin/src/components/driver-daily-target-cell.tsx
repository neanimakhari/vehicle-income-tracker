"use client";

import { useState } from "react";

export function DriverDailyTargetCell({
  driverId,
  initial,
}: {
  driverId: string;
  initial: number | null | undefined;
}) {
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const raw = value.trim();
      const amount = raw === "" ? null : Number(raw);
      if (amount != null && (Number.isNaN(amount) || amount < 0)) {
        return;
      }
      const res = await fetch(`/api/proxy/tenant/users/${driverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTargetAmount: amount }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1 min-w-[7.5rem]">
      <input
        className="input py-1.5 px-2 text-xs w-24"
        inputMode="decimal"
        placeholder="Target"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        aria-label="Daily target amount"
      />
      {saving ? (
        <span className="text-[10px] text-zinc-500">…</span>
      ) : saved ? (
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">OK</span>
      ) : null}
    </div>
  );
}

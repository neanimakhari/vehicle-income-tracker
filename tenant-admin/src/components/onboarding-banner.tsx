"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Car, Users, DollarSign, X, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "vit_tenant_onboarding_done";

export function OnboardingBanner({
  hasDrivers,
  hasVehicles,
}: {
  hasDrivers: boolean;
  hasVehicles: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY) === "true";
      setDismissed(done);
    } catch {
      setDismissed(false);
    }
  }, []);

  const show = !hasDrivers && !hasVehicles && !dismissed;

  const markDone = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      setDismissed(true);
    } catch {
      setDismissed(true);
    }
  };

  if (!show) return null;

  return (
    <div className="card border-teal-200 bg-teal-50/80 dark:border-teal-800 dark:bg-teal-950/40 p-6 relative">
      <button
        type="button"
        onClick={markDone}
        className="absolute top-4 right-4 rounded p-1.5 text-zinc-500 hover:bg-teal-200/50 hover:text-zinc-700 dark:hover:bg-teal-800/50 dark:hover:text-zinc-300"
        aria-label="Dismiss onboarding"
      >
        <X className="h-5 w-5" />
      </button>
      <h3 className="text-lg font-semibold text-teal-800 dark:text-teal-200 pr-8">
        Get started with your fleet
      </h3>
      <p className="mt-1 text-sm text-teal-700 dark:text-teal-300">
        Add your first vehicle and invite a driver to start tracking income.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-teal-700"
        >
          <Car className="h-4 w-4" />
          Add your first vehicle
        </Link>
        <Link
          href="/drivers"
          className="inline-flex items-center gap-2 rounded-lg border border-teal-600 bg-white px-4 py-2 text-sm font-medium text-teal-700 transition-all hover:bg-teal-50 dark:border-teal-500 dark:bg-teal-900/30 dark:text-teal-200 dark:hover:bg-teal-900/50"
        >
          <Users className="h-4 w-4" />
          Invite your first driver
        </Link>
        <Link
          href="/incomes"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <DollarSign className="h-4 w-4" />
          Log first income
        </Link>
      </div>
      <button
        type="button"
        onClick={markDone}
        className="mt-4 inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:underline"
      >
        <CheckCircle2 className="h-4 w-4" />
        I’ll do this later
      </button>
    </div>
  );
}


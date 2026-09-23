"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionTab = { href: string; label: string };

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900/60">
      {tabs.map((t) => {
        const active =
          pathname === t.href ||
          (t.href !== "/tracking" &&
            t.href !== "/tracking/geofences" &&
            pathname.startsWith(`${t.href}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-white text-teal-800 shadow-sm dark:bg-zinc-800 dark:text-teal-300"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function TrackingSectionTabs({
  showAlerts = false,
}: {
  showAlerts?: boolean;
}) {
  const tabs: SectionTab[] = [
    { href: "/tracking", label: "Map" },
    { href: "/tracking/setup", label: "Setup" },
    { href: "/tracking/analytics", label: "Analytics" },
    { href: "/tracking/reconciliation", label: "Reconciliation" },
    { href: "/tracking/trips", label: "Trips & parking" },
  ];
  if (showAlerts) {
    tabs.push({ href: "/tracking/alerts", label: "Alerts" });
  }
  return <SectionTabs tabs={tabs} />;
}

export function GeofenceSectionTabs() {
  return (
    <SectionTabs
      tabs={[
        { href: "/tracking/geofences", label: "Zones" },
        { href: "/tracking/geofences/events", label: "Events" },
        { href: "/tracking/geofences/daily", label: "Daily" },
      ]}
    />
  );
}

export function TrackingShell({
  showAlerts = false,
  children,
}: {
  showAlerts?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <TrackingSectionTabs showAlerts={showAlerts} />
      {children}
    </div>
  );
}

export function GeofenceShell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <GeofenceSectionTabs />
      {children}
    </div>
  );
}

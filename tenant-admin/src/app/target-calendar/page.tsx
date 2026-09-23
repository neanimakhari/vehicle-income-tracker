import { requireAuth } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { TargetCalendarClient } from "./target-calendar-client";
import { entitlementList, hasModule } from "@/lib/entitlements";
import { ModuleLocked } from "@/components/module-locked";

export default async function TargetCalendarPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  if (!hasModule(entitlementList(policy), "target_calendar")) {
    return <ModuleLocked title="Target Calendar" moduleKey="target_calendar" />;
  }

  const [rules, drivers] = await Promise.all([
    fetchJson<
      Array<{
        id: string;
        scope: "tenant" | "driver";
        driverUserId: string | null;
        ruleType: "weekday" | "date_range" | "exact_date" | "closed";
        amount: number | null;
        weekdays: number[] | null;
        startDate: string | null;
        endDate: string | null;
        exactDate: string | null;
        priority: number;
        isActive: boolean;
      }>
    >("/tenant/target-rules"),
    fetchJson<
      Array<{ id: string; firstName: string; lastName: string; isActive: boolean }>
    >("/tenant/users"),
  ]);

  return (
    <TargetCalendarClient
      initialRules={rules ?? []}
      drivers={(drivers ?? [])
        .filter((d) => d.isActive)
        .map((d) => ({
          id: d.id,
          label: `${d.firstName} ${d.lastName}`.trim(),
        }))}
    />
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getApiUrl } from "@/lib/api-client";

type Vehicle = { id: string; label: string; registrationNumber: string; seatCapacity?: number | null };
type Group = {
  id: string;
  name: string;
  kind: string;
  defaultAmount: number;
  cadence: string;
  dueDay: number | null;
  graceDays: number;
};
type Passenger = {
  id: string;
  type: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  vehicleId: string | null;
  groupId: string | null;
  householdId: string | null;
  feeAmount: number | null;
  feeCadence: string | null;
  isActive: boolean;
};
type Arrear = {
  periodId: string;
  passengerId: string;
  passengerName: string;
  passengerType: string;
  vehicleId: string | null;
  groupName: string | null;
  expected: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
};
type Claim = {
  id: string;
  passengerId: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  notes: string | null;
  collectedByDriverId: string | null;
};
type Pause = { id: string; label: string; startDate: string; endDate: string };

type Tab = "passengers" | "groups" | "arrears" | "payments" | "reports" | "pauses";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function TransportClient({
  initialVehicles,
}: {
  initialVehicles: Vehicle[];
}) {
  const [tab, setTab] = useState<Tab>("passengers");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [vehicles] = useState(initialVehicles);
  const [groups, setGroups] = useState<Group[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [arrears, setArrears] = useState<Arrear[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [pauses, setPauses] = useState<Pause[]>([]);
  const [summary, setSummary] = useState<{
    expected: number;
    paid: number;
    balance: number;
    overdueCount: number;
    collectionRate: number;
  } | null>(null);
  const [byVehicle, setByVehicle] = useState<Array<{ label: string; total: number; count: number }>>([]);
  const [byGroup, setByGroup] = useState<
    Array<{ name: string; expected: number; paid: number; collectionRate: number }>
  >([]);
  const [driverCols, setDriverCols] = useState<
    Array<{ driverId: string; pending: number; approved: number; count: number }>
  >([]);

  const vehicleLabel = useCallback(
    (id: string | null) => {
      if (!id) return "—";
      const v = vehicles.find((x) => x.id === id);
      return v ? `${v.registrationNumber} (${v.label})` : id.slice(0, 8);
    },
    [vehicles],
  );

  const reload = useCallback(() => {
    startTransition(async () => {
      try {
        const [g, p, a, c, pausesRes, sum, bv, bg, dc] = await Promise.all([
          api<Group[]>("/tenant/transport/groups"),
          api<Passenger[]>("/tenant/transport/passengers?activeOnly=false"),
          api<Arrear[]>("/tenant/transport/arrears"),
          api<Claim[]>("/tenant/transport/payments"),
          api<Pause[]>("/tenant/transport/pauses"),
          api<{
            expected: number;
            paid: number;
            balance: number;
            overdueCount: number;
            collectionRate: number;
          }>("/tenant/transport/reports/summary"),
          api<Array<{ label: string; total: number; count: number }>>(
            "/tenant/transport/reports/by-vehicle",
          ),
          api<
            Array<{ name: string; expected: number; paid: number; collectionRate: number }>
          >("/tenant/transport/reports/by-group"),
          api<Array<{ driverId: string; pending: number; approved: number; count: number }>>(
            "/tenant/transport/reports/driver-collections",
          ),
        ]);
        setGroups(g);
        setPassengers(p);
        setArrears(a);
        setClaims(c);
        setPauses(pausesRes);
        setSummary(sum);
        setByVehicle(bv);
        setByGroup(bg);
        setDriverCols(dc);
      } catch (e) {
        setMessage((e as Error).message);
      }
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "passengers", label: "Passengers" },
    { id: "groups", label: "Groups" },
    { id: "arrears", label: "Who paid / owes" },
    { id: "payments", label: "Payments" },
    { id: "reports", label: "Reports" },
    { id: "pauses", label: "Fee pauses" },
  ];

  const passengerName = useMemo(() => {
    const m = new Map(passengers.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [passengers]);

  async function onCreateGroup(form: FormData) {
    setMessage(null);
    try {
      await api("/tenant/transport/groups", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          kind: String(form.get("kind") ?? "school"),
          defaultAmount: Number(form.get("defaultAmount") ?? 0),
          cadence: String(form.get("cadence") ?? "monthly"),
          dueDay: Number(form.get("dueDay") ?? 1) || 1,
          graceDays: Number(form.get("graceDays") ?? 7) || 7,
        }),
      });
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function onCreatePassenger(form: FormData) {
    setMessage(null);
    try {
      const res = await api<{ seatWarning?: { warning: string } | null }>(
        "/tenant/transport/passengers",
        {
          method: "POST",
          body: JSON.stringify({
            name: String(form.get("name") ?? ""),
            type: String(form.get("type") ?? "scholar"),
            vehicleId: String(form.get("vehicleId") ?? "") || null,
            groupId: String(form.get("groupId") ?? "") || null,
            contactName: String(form.get("contactName") ?? "") || null,
            phone: String(form.get("phone") ?? "") || null,
            feeAmount: form.get("feeAmount") ? Number(form.get("feeAmount")) : null,
            feeCadence: String(form.get("feeCadence") ?? "") || null,
            householdId: String(form.get("householdId") ?? "") || null,
          }),
        },
      );
      if (res.seatWarning?.warning) setMessage(res.seatWarning.warning);
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function onImportCsv(file: File) {
    setMessage(null);
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setMessage("CSV needs a header row and at least one data row");
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return {
        name: cols[idx("name")] ?? "",
        type: cols[idx("type")] || "scholar",
        vehicleReg: cols[idx("vehicle_reg")] || cols[idx("vehiclereg")] || undefined,
        groupName: cols[idx("group_name")] || cols[idx("group")] || undefined,
        feeAmount: cols[idx("fee_amount")] ? Number(cols[idx("fee_amount")]) : undefined,
        cadence: cols[idx("cadence")] || undefined,
        contactName: cols[idx("contact")] || cols[idx("guardian")] || undefined,
        phone: cols[idx("phone")] || undefined,
      };
    });
    try {
      const res = await api<{ created: number; errors: string[] }>(
        "/tenant/transport/passengers/import",
        { method: "POST", body: JSON.stringify({ rows }) },
      );
      setMessage(
        `Imported ${res.created} passenger(s)${res.errors.length ? `; ${res.errors.length} error(s)` : ""}`,
      );
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function onCreateClaim(form: FormData) {
    setMessage(null);
    try {
      await api("/tenant/transport/payments", {
        method: "POST",
        body: JSON.stringify({
          passengerId: String(form.get("passengerId") ?? ""),
          amount: Number(form.get("amount") ?? 0),
          method: String(form.get("method") ?? "cash"),
          notes: String(form.get("notes") ?? "") || null,
          collectedByDriverId: String(form.get("collectedByDriverId") ?? "") || null,
          autoApprove: form.get("autoApprove") === "on",
        }),
      });
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function approve(id: string) {
    await api(`/tenant/transport/payments/${id}/approve`, { method: "POST", body: "{}" });
    reload();
  }

  async function reject(id: string) {
    const reason = prompt("Reject reason?") ?? "";
    if (!reason.trim()) return;
    await api(`/tenant/transport/payments/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    reload();
  }

  async function onCreatePause(form: FormData) {
    await api("/tenant/transport/pauses", {
      method: "POST",
      body: JSON.stringify({
        label: String(form.get("label") ?? ""),
        startDate: String(form.get("startDate") ?? ""),
        endDate: String(form.get("endDate") ?? ""),
      }),
    });
    reload();
  }

  async function newHousehold(): Promise<string> {
    const res = await api<{ householdId: string }>("/tenant/transport/households", {
      method: "POST",
      body: "{}",
    });
    return res.householdId;
  }

  void getApiUrl;

  const field =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";
  const labelCls = "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";
  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Scholar &amp; staff transport
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Roster, fees, arrears, and payment approval — kept separate from day-to-day vehicle income.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Expected" value={summary?.expected ?? 0} />
        <Stat label="Collected" value={summary?.paid ?? 0} />
        <Stat label="Outstanding" value={summary?.balance ?? 0} />
        <Stat label="Overdue" value={summary?.overdueCount ?? 0} money={false} />
      </div>

      {message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-teal-800 shadow-sm dark:bg-zinc-800 dark:text-teal-300"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
        {pending && (
          <span className="ml-auto self-center pr-2 text-xs text-zinc-500">Refreshing…</span>
        )}
      </div>

      {tab === "groups" && (
        <section className="space-y-4">
          <form
            action={onCreateGroup}
            className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add group</h2>
              <p className="mt-0.5 text-sm text-zinc-500">School, route, or destination with a default fee.</p>
            </div>
            <div className="space-y-6 px-5 py-5">
              <div>
                <p className={sectionTitle}>Basics</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input name="name" required placeholder="e.g. ABC Primary" className={field} />
                  </div>
                  <div>
                    <label className={labelCls}>Kind</label>
                    <select name="kind" className={field} defaultValue="school">
                      <option value="school">School</option>
                      <option value="route">Route</option>
                      <option value="destination">Destination</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <p className={sectionTitle}>Fees</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Default fee (R)</label>
                    <input name="defaultAmount" type="number" step="0.01" placeholder="0.00" className={field} />
                  </div>
                  <div>
                    <label className={labelCls}>Cadence</label>
                    <select name="cadence" className={field} defaultValue="monthly">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Due day (1–28)</label>
                    <input name="dueDay" type="number" min={1} max={28} defaultValue={1} className={field} />
                  </div>
                  <div>
                    <label className={labelCls}>Grace days</label>
                    <input name="graceDays" type="number" min={0} defaultValue={7} className={field} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <button type="submit" className="btn-primary min-h-11 px-5">
                Save group
              </button>
            </div>
          </form>
          <Table
            headers={["Name", "Kind", "Fee", "Cadence", "Grace"]}
            rows={groups.map((g) => [
              g.name,
              g.kind,
              money(g.defaultAmount),
              g.cadence,
              String(g.graceDays),
            ])}
            emptyHint="Create a group to set shared fees for passengers."
          />
        </section>
      )}

      {tab === "passengers" && (
        <section className="space-y-4">
          <form
            action={onCreatePassenger}
            className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add passenger</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Link a scholar or staff rider to a vehicle. Fees inherit from the group unless overridden.
              </p>
            </div>

            <div className="space-y-6 px-5 py-5">
              <div>
                <p className={sectionTitle}>Identity</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Name</label>
                    <input name="name" required placeholder="Full name" className={field} autoComplete="name" />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select name="type" className={field} defaultValue="scholar">
                      <option value="scholar">Scholar</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Assignment</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Vehicle</label>
                    <select name="vehicleId" required className={field} defaultValue="">
                      <option value="" disabled>
                        Select vehicle
                      </option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registrationNumber} — {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Group</label>
                    <select name="groupId" className={field} defaultValue="">
                      <option value="">No group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Contact</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Guardian / contact</label>
                    <input name="contactName" placeholder="Optional" className={field} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input name="phone" type="tel" placeholder="Optional" className={field} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Fees (optional overrides)</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Fee override (R)</label>
                    <input
                      name="feeAmount"
                      type="number"
                      step="0.01"
                      placeholder="Leave blank for group default"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Cadence override</label>
                    <select name="feeCadence" className={field} defaultValue="">
                      <option value="">From group</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Household (siblings)</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={labelCls}>Household ID</label>
                    <input
                      name="householdId"
                      id="householdId"
                      placeholder="Shared ID for siblings on different vehicles"
                      className={field}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary min-h-11"
                    onClick={async () => {
                      const id = await newHousehold();
                      const el = document.getElementById("householdId") as HTMLInputElement | null;
                      if (el) el.value = id;
                    }}
                  >
                    Generate new household ID
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <button type="submit" className="btn-primary min-h-11 px-5">
                Add passenger
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/90 px-5 py-5 dark:border-zinc-700 dark:bg-zinc-900/40">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Import CSV</h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Bulk-add passengers. Required columns:{" "}
              <code className="rounded bg-zinc-200/80 px-1 text-xs dark:bg-zinc-800">
                name, type, vehicle_reg
              </code>
              . Optional:{" "}
              <code className="rounded bg-zinc-200/80 px-1 text-xs dark:bg-zinc-800">
                group_name, fee_amount, cadence, contact, phone
              </code>
              .
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-3">
              <span className="btn-secondary min-h-11 inline-flex items-center">Choose CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportCsv(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <Table
            headers={["Name", "Type", "Vehicle", "Group", "Fee", "Active"]}
            rows={passengers.map((p) => [
              p.name,
              p.type,
              vehicleLabel(p.vehicleId),
              groups.find((g) => g.id === p.groupId)?.name ?? "—",
              p.feeAmount != null ? money(p.feeAmount) : "group default",
              p.isActive ? "yes" : "no",
            ])}
            emptyHint="Add a passenger above or import a CSV to build the roster."
          />
        </section>
      )}

      {tab === "arrears" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                const lines = [
                  "name,type,group,expected,paid,balance,status,due,period_start,period_end",
                  ...arrears.map(
                    (a) =>
                      `${a.passengerName},${a.passengerType},${a.groupName ?? ""},${a.expected},${a.paid},${a.balance},${a.status},${a.dueDate},${a.periodStart},${a.periodEnd}`,
                  ),
                ];
                const blob = new Blob([lines.join("\n")], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "transport-arrears.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </button>
          </div>
          <Table
            headers={["Passenger", "Group", "Expected", "Paid", "Balance", "Status", "Due"]}
            rows={arrears.map((a) => [
              a.passengerName,
              a.groupName ?? "—",
              money(a.expected),
              money(a.paid),
              money(a.balance),
              a.status,
              a.dueDate,
            ])}
          />
        </section>
      )}

      {tab === "payments" && (
        <section className="space-y-4">
          <form
            action={onCreateClaim}
            className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Record payment</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Admin entry for cash/EFT against a passenger.</p>
            </div>
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Passenger</label>
                <select name="passengerId" required className={field} defaultValue="">
                  <option value="" disabled>
                    Select passenger
                  </option>
                  {passengers
                    .filter((p) => p.isActive)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Amount (R)</label>
                <input name="amount" required type="number" step="0.01" min="0.01" className={field} />
              </div>
              <div>
                <label className={labelCls}>Method</label>
                <select name="method" className={field} defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="eft">EFT</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Notes</label>
                <input name="notes" placeholder="Optional" className={field} />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:col-span-2">
                <input type="checkbox" name="autoApprove" defaultChecked className="rounded border-zinc-300" />
                Auto-approve (admin entry)
              </label>
            </div>
            <div className="flex justify-end border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <button type="submit" className="btn-primary min-h-11 px-5">
                Save payment
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  {["Passenger", "Amount", "Method", "Status", "Paid at", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">{passengerName(c.passengerId)}</td>
                    <td className="px-3 py-2">{money(c.amount)}</td>
                    <td className="px-3 py-2">{c.method}</td>
                    <td className="px-3 py-2">{c.status}</td>
                    <td className="px-3 py-2">{new Date(c.paidAt).toLocaleString()}</td>
                    <td className="px-3 py-2 space-x-2">
                      {c.status === "pending" && (
                        <>
                          <button type="button" className="text-teal-700 hover:underline" onClick={() => void approve(c.id)}>
                            Approve
                          </button>
                          <button type="button" className="text-red-600 hover:underline" onClick={() => void reject(c.id)}>
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "reports" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">By vehicle</h2>
            <Table
              headers={["Vehicle", "Total", "Payments"]}
              rows={byVehicle.map((r) => [r.label, money(r.total), String(r.count)])}
            />
          </div>
          <div>
            <h2 className="mb-2 font-semibold">By group</h2>
            <Table
              headers={["Group", "Expected", "Paid", "Rate"]}
              rows={byGroup.map((r) => [
                r.name,
                money(r.expected),
                money(r.paid),
                `${Math.round((r.collectionRate || 0) * 100)}%`,
              ])}
            />
          </div>
          <div className="lg:col-span-2">
            <h2 className="mb-2 font-semibold">Driver collection summary</h2>
            <Table
              headers={["Driver ID", "Pending", "Approved", "Claims"]}
              rows={driverCols.map((r) => [
                r.driverId.slice(0, 8),
                money(r.pending),
                money(r.approved),
                String(r.count),
              ])}
            />
          </div>
        </section>
      )}

      {tab === "pauses" && (
        <section className="space-y-4">
          <form
            action={onCreatePause}
            className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add fee pause</h2>
              <p className="mt-0.5 text-sm text-zinc-500">School holidays or other periods with no fees due.</p>
            </div>
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Label</label>
                <input name="label" required placeholder="e.g. Dec holidays" className={field} />
              </div>
              <div>
                <label className={labelCls}>Start date</label>
                <input name="startDate" required type="date" className={field} />
              </div>
              <div>
                <label className={labelCls}>End date</label>
                <input name="endDate" required type="date" className={field} />
              </div>
            </div>
            <div className="flex justify-end border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <button type="submit" className="btn-primary min-h-11 px-5">
                Add fee pause
              </button>
            </div>
          </form>
          <Table
            headers={["Label", "Start", "End"]}
            rows={pauses.map((p) => [p.label, p.startDate, p.endDate])}
            emptyHint="No fee pauses yet."
          />
        </section>
      )}
    </div>
  );
}

function money(n: number) {
  return `R ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Stat({
  label,
  value,
  money: isMoney = true,
}: {
  label: string;
  value: number;
  money?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {isMoney ? money(value) : value}
      </div>
    </div>
  );
}

function Table({
  headers,
  rows,
  emptyHint = "No rows yet.",
}: {
  headers: string[];
  rows: string[][];
  emptyHint?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-zinc-500" colSpan={headers.length}>
                {emptyHint}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

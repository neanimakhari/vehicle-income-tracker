"use client";

import { useState } from "react";
import { FullscreenImageViewer, toDataUrl } from "@/components/fullscreen-image-viewer";

type Income = {
  id: string;
  vehicle: string;
  driverName: string;
  income: number;
  startingKm?: number;
  endKm?: number;
  petrolPoured?: number;
  petrolLitres?: number;
  expenseDetail?: string;
  expensePrice?: number;
  expenseImage?: string;
  petrolSlip?: string;
  loggedOn: string;
  approvalStatus?: string;
};

export type IncomeHistoryEvent = {
  id: string;
  action: string;
  reason: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

function actionLabel(action: string): string {
  switch (action) {
    case "create":
      return "Created";
    case "update":
      return "Edited";
    case "approve":
      return "Approved";
    case "reject":
      return "Rejected";
    case "delete":
      return "Deleted";
    default:
      return action;
  }
}

function fieldDiffs(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before || !after) return [];
  const keys = ["income", "vehicle", "driverName", "startingKm", "endKm", "petrolPoured", "expensePrice", "approvalStatus"];
  const out: string[] = [];
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (String(b ?? "") !== String(a ?? "")) {
      out.push(`${k}: ${b ?? "—"} → ${a ?? "—"}`);
    }
  }
  return out;
}

export function IncomeViewClient({
  income,
  history,
}: {
  income: Income;
  history: IncomeHistoryEvent[];
}) {
  const [viewerImage, setViewerImage] = useState<{ dataUrl: string; title: string } | null>(null);
  const petrolUrl = income.petrolSlip ? toDataUrl(income.petrolSlip) : null;
  const expenseUrl = income.expenseImage ? toDataUrl(income.expenseImage) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Income details</h1>
          {income.approvalStatus ? (
            <span className="text-xs font-mono uppercase tracking-wide text-zinc-500">
              {income.approvalStatus}
            </span>
          ) : null}
        </div>
        <dl className="px-6 py-4 space-y-4">
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Date</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
              {new Date(income.loggedOn).toLocaleDateString(undefined, { dateStyle: "long" })}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Vehicle</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.vehicle}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Driver</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.driverName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Income</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">R {income.income.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Starting KM</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.startingKm ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">End KM</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.endKm ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Petrol poured (R)</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
              {income.petrolPoured != null ? income.petrolPoured.toFixed(2) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Petrol (L)</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
              {income.petrolLitres != null ? income.petrolLitres.toFixed(2) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Expense detail</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.expenseDetail ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Expense price (R)</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
              {income.expensePrice != null ? income.expensePrice.toFixed(2) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Petrol slip</dt>
            <dd>
              {petrolUrl ? (
                <button
                  type="button"
                  onClick={() => setViewerImage({ dataUrl: petrolUrl, title: "Petrol slip" })}
                  className="block overflow-hidden rounded border border-zinc-200 dark:border-zinc-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={petrolUrl}
                    alt="Petrol slip"
                    className="max-h-48 w-auto object-contain bg-zinc-50 dark:bg-zinc-800"
                  />
                </button>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 text-sm">No image</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Expense receipt</dt>
            <dd>
              {expenseUrl ? (
                <button
                  type="button"
                  onClick={() => setViewerImage({ dataUrl: expenseUrl, title: "Expense receipt" })}
                  className="block overflow-hidden rounded border border-zinc-200 dark:border-zinc-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={expenseUrl}
                    alt="Expense receipt"
                    className="max-h-48 w-auto object-contain bg-zinc-50 dark:bg-zinc-800"
                  />
                </button>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 text-sm">No image</span>
              )}
            </dd>
          </div>
        </dl>
        {viewerImage && (
          <FullscreenImageViewer
            imageDataUrl={viewerImage.dataUrl}
            title={viewerImage.title}
            onClose={() => setViewerImage(null)}
          />
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dispute trail</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Who created, edited, approved, or rejected this income — and why.
          </p>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {history.length === 0 ? (
            <li className="px-6 py-6 text-sm text-zinc-500">No history events yet.</li>
          ) : (
            history.map((ev) => {
              const diffs = fieldDiffs(ev.before, ev.after);
              return (
                <li key={ev.id} className="px-6 py-4 space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {actionLabel(ev.action)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(ev.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {ev.actorName || ev.actorEmail || "Unknown actor"}
                    {ev.actorRole ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-400">
                        {ev.actorRole === "TENANT_ADMIN" ? "admin" : "driver"}
                      </span>
                    ) : null}
                  </p>
                  {ev.reason ? (
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      Reason: {ev.reason}
                    </p>
                  ) : null}
                  {diffs.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs font-mono text-zinc-500">
                      {diffs.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

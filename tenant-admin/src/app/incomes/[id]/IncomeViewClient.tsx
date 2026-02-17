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
};

export function IncomeViewClient({ income }: { income: Income }) {
  const [viewerImage, setViewerImage] = useState<{ dataUrl: string; title: string } | null>(null);
  const petrolUrl = income.petrolSlip ? toDataUrl(income.petrolSlip) : null;
  const expenseUrl = income.expenseImage ? toDataUrl(income.expenseImage) : null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Income details</h1>
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
          <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.petrolPoured != null ? income.petrolPoured.toFixed(2) : "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Petrol (L)</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.petrolLitres != null ? income.petrolLitres.toFixed(2) : "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Expense detail</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.expenseDetail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Expense price (R)</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{income.expensePrice != null ? income.expensePrice.toFixed(2) : "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Petrol slip</dt>
          <dd>
            {petrolUrl ? (
              <button
                type="button"
                onClick={() => setViewerImage({ dataUrl: petrolUrl, title: "Petrol slip" })}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:ring-2 hover:ring-teal-500 transition-all"
              >
                <img src={petrolUrl} alt="Petrol slip" className="max-h-48 w-auto object-contain bg-zinc-50 dark:bg-zinc-800" />
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
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:ring-2 hover:ring-teal-500 transition-all"
              >
                <img src={expenseUrl} alt="Expense receipt" className="max-h-48 w-auto object-contain bg-zinc-50 dark:bg-zinc-800" />
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
  );
}


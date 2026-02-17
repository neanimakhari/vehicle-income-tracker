"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";

interface Income {
  id: string;
  vehicle: string;
  driverName: string;
  driverId?: string;
  income: number;
  startingKm?: number;
  endKm?: number;
  petrolPoured?: number;
  petrolLitres?: number;
  expenseDetail?: string;
  expensePrice?: number;
  loggedOn: string;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

interface Vehicle {
  id: string;
  label: string;
  registrationNumber: string;
}

export function IncomeEditButton({
  income,
  drivers,
  vehicles,
  updateIncome,
}: {
  income: Income;
  drivers: Driver[];
  vehicles: Vehicle[];
  updateIncome: (formData: FormData) => Promise<unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
        title="Edit Income"
      >
        <Pencil className="h-4 w-4" />
      </button>
    );
  }

  const loggedOnDate = new Date(income.loggedOn);
  const loggedOnLocal = new Date(loggedOnDate.getTime() - loggedOnDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Edit Income</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          action={async (formData) => {
            await updateIncome(formData);
            setIsOpen(false);
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <input type="hidden" name="id" value={income.id} />
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Vehicle
            </label>
            <select className="input w-full px-3 py-2 text-sm" name="vehicle" required defaultValue={income.vehicle}>
              <option value="">Select Vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.label}>
                  {v.label} {v.registrationNumber ? `(${v.registrationNumber})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Driver
            </label>
            <select className="input w-full px-3 py-2 text-sm" name="driverId" required defaultValue={income.driverId || ''}>
              <option value="">Select Driver</option>
              {drivers.filter(d => d.isActive).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Income (R)
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="income" type="number" step="0.01" required defaultValue={income.income} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Date
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="loggedOn" type="datetime-local" required defaultValue={loggedOnLocal} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Starting KM
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="startingKm" type="number" defaultValue={income.startingKm ?? ''} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              End KM
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="endKm" type="number" defaultValue={income.endKm ?? ''} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Petrol Cost (R)
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="petrolPoured" type="number" step="0.01" defaultValue={income.petrolPoured ?? ''} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Petrol Litres
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="petrolLitres" type="number" step="0.01" defaultValue={income.petrolLitres ?? ''} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Expense Detail
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="expenseDetail" defaultValue={income.expenseDetail ?? ''} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Expense Price (R)
            </label>
            <input className="input w-full px-3 py-2 text-sm" name="expensePrice" type="number" step="0.01" defaultValue={income.expensePrice ?? ''} />
          </div>
          <div className="col-span-full flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


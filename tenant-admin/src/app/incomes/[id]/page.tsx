import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { IncomeViewClient } from "./IncomeViewClient";

type Income = {
  id: string;
  vehicle: string;
  driverName: string;
  income: number;
  startingKm?: number | null;
  endKm?: number | null;
  petrolPoured?: number | null;
  petrolLitres?: number | null;
  expenseDetail?: string | null;
  expensePrice?: number | null;
  expenseImage?: string | null;
  petrolSlip?: string | null;
  loggedOn: string;
};

export default async function IncomeViewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const income = await fetchJson<Income>(`/tenant/incomes/${id}`);
  if (!income) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Income not found.</p>
        <Link href="/incomes" className="mt-4 inline-block text-teal-600 hover:text-teal-700 dark:text-teal-400">
          ← Back to Incomes
        </Link>
      </div>
    );
  }
  const normalized = {
    id: income.id,
    vehicle: income.vehicle,
    driverName: income.driverName,
    income: Number(income.income) || 0,
    startingKm: income.startingKm != null ? Number(income.startingKm) : undefined,
    endKm: income.endKm != null ? Number(income.endKm) : undefined,
    petrolPoured: income.petrolPoured != null ? Number(income.petrolPoured) : undefined,
    petrolLitres: income.petrolLitres != null ? Number(income.petrolLitres) : undefined,
    expenseDetail: income.expenseDetail ?? undefined,
    expensePrice: income.expensePrice != null ? Number(income.expensePrice) : undefined,
    expenseImage: income.expenseImage ?? undefined,
    petrolSlip: income.petrolSlip ?? undefined,
    loggedOn: income.loggedOn,
  };
  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link href="/incomes" className="inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 mb-6">
        ← Back to Incomes
      </Link>
      <IncomeViewClient income={normalized} />
    </div>
  );
}


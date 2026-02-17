import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { ExpenseViewClient } from "./ExpenseViewClient";

type Expense = {
  id: string;
  description: string;
  amount: number;
  receiptImage?: string | null;
  receipt_image?: string | null;
  loggedOn?: string;
};

export default async function ExpenseViewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const expense = await fetchJson<Expense>(`/tenant/expenses/${id}`);
  if (!expense) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-zinc-600 dark:text-zinc-400">Expense not found.</p>
        <Link href="/expenses" className="mt-4 inline-block text-teal-600 hover:text-teal-700 dark:text-teal-400">
          ← Back to Expenses
        </Link>
      </div>
    );
  }
  const normalized = {
    id: expense.id,
    description: expense.description,
    amount: Number(expense.amount) || 0,
    receiptImage: expense.receiptImage ?? expense.receipt_image ?? undefined,
    loggedOn: expense.loggedOn,
  };
  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link href="/expenses" className="inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 mb-6">
        ← Back to Expenses
      </Link>
      <ExpenseViewClient expense={normalized} />
    </div>
  );
}


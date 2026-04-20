import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { ExpensesClient } from "./ExpensesClient";

async function fetchExpenses() {
  const raw = await fetchJson<
    Array<{
      id: string;
      sourceType: "manual" | "income";
      sourceId: string;
      description: string;
      amount: number;
      receiptImage?: string | null;
      receipt_image?: string | null;
      loggedOn?: string;
    }>
  >("/tenant/expenses/unified");
  const list = raw ?? [];
  return list.map((e) => ({
    id: e.id,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    description: e.description,
    amount: Number(e.amount) || 0,
    receiptImage: e.receiptImage ?? e.receipt_image ?? undefined,
    loggedOn: e.loggedOn ?? undefined,
  }));
}

export default async function ExpensesPage() {
  await requireAuth();
  const expenses = await fetchExpenses();

  async function createExpense(formData: FormData): Promise<{ success: boolean; error?: string }> {
    "use server";
    const description = String(formData.get("description") ?? "").trim();
    const amount = Number(formData.get("amount") ?? 0);
    const receiptImage = formData.get("receiptImage");
    const receiptImageStr = typeof receiptImage === "string" && receiptImage.trim() ? receiptImage.trim() : undefined;
    if (!description || !amount) {
      return { success: false, error: "Description and amount are required" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          description,
          amount,
          receiptImage: receiptImageStr ?? undefined,
          loggedOn: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        return { success: false, error: err.message ?? "Failed to create expense" };
      }
      revalidatePath("/expenses");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  async function deleteExpense(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await fetch(`${getApiUrl()}/tenant/expenses/unified/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { ...(await getAuthHeaders()) },
    });
    revalidatePath("/expenses");
  }

  async function updateExpense(formData: FormData): Promise<{ success: boolean; error?: string }> {
    "use server";
    const id = String(formData.get("id") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const amount = Number(formData.get("amount") ?? 0);
    const loggedOn = String(formData.get("loggedOn") ?? "").trim();
    const receiptImage = formData.get("receiptImage");
    const receiptImageValue =
      typeof receiptImage === "string"
        ? receiptImage.trim() === ""
          ? null
          : receiptImage.trim()
        : undefined;

    if (!id || !description || !amount || !loggedOn) {
      return { success: false, error: "Description, amount and date are required" };
    }

    try {
      const res = await fetch(`${getApiUrl()}/tenant/expenses/unified/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          description,
          amount,
          loggedOn: new Date(loggedOn).toISOString(),
          ...(receiptImageValue !== undefined ? { receiptImage: receiptImageValue } : {}),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        return { success: false, error: err.message ?? "Failed to update expense" };
      }
      revalidatePath("/expenses");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  return (
    <ExpensesClient
      expenses={expenses}
      createExpense={createExpense}
      updateExpense={updateExpense}
      deleteExpense={deleteExpense}
    />
  );
}


import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { revalidatePath } from "next/cache";

async function fetchScholarPayments() {
  const items = await fetchJson<
    Array<{
      id: string;
      scholarName: string;
      guardianName: string | null;
      amount: number;
      status: string;
      dueDate: string | null;
      createdAt: string;
    }>
  >("/tenant/scholar-payments");
  return items ?? [];
}

export default async function ScholarPaymentsPage() {
  await requireAuth();
  const payments = await fetchScholarPayments();

  async function createPayment(formData: FormData) {
    "use server";
    const payload = {
      scholarName: String(formData.get("scholarName") ?? "").trim(),
      guardianName: String(formData.get("guardianName") ?? "") || null,
      amount: Number(formData.get("amount") ?? 0) || 0,
      dueDate: String(formData.get("dueDate") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    };
    if (!payload.scholarName || payload.amount <= 0) return;
    await fetch(`${getApiUrl()}/tenant/scholar-payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(payload),
    });
    revalidatePath("/scholar-payments");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Scholar Payments</h1>
      <div className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Create Scholar Payment</h2>
        <form action={createPayment} className="grid gap-3 md:grid-cols-2">
          <input name="scholarName" required placeholder="Scholar name" className="input w-full px-3 py-2 text-sm" />
          <input name="guardianName" placeholder="Guardian name" className="input w-full px-3 py-2 text-sm" />
          <input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="input w-full px-3 py-2 text-sm" />
          <input name="dueDate" type="date" className="input w-full px-3 py-2 text-sm" />
          <textarea name="notes" placeholder="Notes" className="input w-full px-3 py-2 text-sm md:col-span-2" rows={3} />
          <button className="btn btn-primary w-fit md:col-span-2" type="submit">Create Payment</button>
        </form>
      </div>
      <div className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Payments</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold">Scholar</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-3 py-2 text-sm">{payment.scholarName}</td>
                  <td className="px-3 py-2 text-sm">R {Number(payment.amount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-sm">{payment.status}</td>
                  <td className="px-3 py-2 text-sm">{payment.dueDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


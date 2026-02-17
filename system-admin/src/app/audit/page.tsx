import { requireAuth } from "@/lib/auth";
import { getApiUrl, getAuthHeaders } from "../../lib/api";
import { AuditClient, type AuditLog } from "./AuditClient";

export default async function AuditPage() {
  await requireAuth();

  async function fetchAudit(params: {
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: "ASC" | "DESC";
    page?: number;
    limit?: number;
  }): Promise<{ items: AuditLog[]; total: number }> {
    "use server";
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", String(limit));
    if (params.sort) q.set("sort", params.sort);
    if (params.order) q.set("order", params.order);
    if (params.action) q.set("action", params.action);
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);
    const res = await fetch(`${getApiUrl()}/platform/audit?${q.toString()}`, {
      cache: "no-store",
      headers: { ...(await getAuthHeaders()) },
    });
    if (!res.ok) return { items: [], total: 0 };
    const data = (await res.json()) as { items: AuditLog[]; total: number };
    return { items: data.items ?? [], total: data.total ?? 0 };
  }

  return <AuditClient fetchAudit={fetchAudit} />;
}

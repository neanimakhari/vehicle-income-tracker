import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExpiryRequestDetail } from "./ExpiryRequestDetail";

type ExpiryRequest = {
  id: string;
  userId: string;
  status: string;
  requestedLicenseExpiry: string | null;
  requestedPrdpExpiry: string | null;
  requestedMedicalCertificateExpiry: string | null;
  supportingDocumentIds: string[] | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
};

type DriverDoc = { id: string; documentType: string; fileName: string; createdAt: string };

async function fetchRequest(requestId: string): Promise<ExpiryRequest | null> {
  const req = await fetchJson<ExpiryRequest>(
    `/tenant/drivers/expiry-update-requests/${requestId}`
  );
  return req ?? null;
}

async function fetchDriverProfile(driverId: string) {
  return fetchJson<{
    id: string;
    firstName: string;
    lastName: string;
    licenseExpiry?: string | null;
    prdpExpiry?: string | null;
    medicalCertificateExpiry?: string | null;
  }>(`/tenant/drivers/${driverId}/profile`);
}

async function fetchDriverDocuments(driverId: string): Promise<DriverDoc[]> {
  const list = await fetchJson<DriverDoc[]>(`/tenant/drivers/${driverId}/documents`);
  return Array.isArray(list) ? list : [];
}

export default async function ExpiryRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await requireAuth();
  const { requestId } = await params;
  const request = await fetchRequest(requestId);
  if (!request) notFound();
  if (request.status !== "pending") {
    return (
      <div className="p-6">
        <Link href="/expiry-requests" className="text-sm text-primary hover:underline mb-4 inline-block">
          ← Back to expiry requests
        </Link>
        <p className="text-zinc-600 dark:text-zinc-400">
          This request has already been {request.status}.
        </p>
      </div>
    );
  }

  const [profile, documents] = await Promise.all([
    fetchDriverProfile(request.userId),
    fetchDriverDocuments(request.userId),
  ]);

  const supportingDocs = (request.supportingDocumentIds ?? []).map((id) =>
    documents.find((d) => d.id === id)
  ).filter(Boolean) as DriverDoc[];

  async function approveRequest(): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(
        `${getApiUrl()}/tenant/drivers/expiry-update-requests/${requestId}/approve`,
        { method: "PATCH", headers: await getAuthHeaders() }
      );
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      revalidatePath("/expiry-requests");
      revalidatePath(`/expiry-requests/${requestId}`);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async function rejectRequest(reason?: string): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(
        `${getApiUrl()}/tenant/drivers/expiry-update-requests/${requestId}/reject`,
        {
          method: "PATCH",
          headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? undefined }),
        }
      );
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      revalidatePath("/expiry-requests");
      revalidatePath(`/expiry-requests/${requestId}`);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <Link href="/expiry-requests" className="text-sm text-primary hover:underline mb-4 inline-block">
        ← Back to expiry requests
      </Link>
      <ExpiryRequestDetail
        request={request}
        profile={profile}
        supportingDocs={supportingDocs}
        approveRequest={approveRequest}
        rejectRequest={rejectRequest}
      />
    </div>
  );
}


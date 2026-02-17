import { requireAuth } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { ExpiryRequestsClient } from "./ExpiryRequestsClient";

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
  driverName?: string;
};

async function fetchExpiryRequests(status?: "pending" | "approved" | "rejected") {
  const q = status ? `?status=${status}` : "";
  const list = await fetchJson<ExpiryRequest[]>(
    `/tenant/drivers/expiry-update-requests${q}`
  );
  return Array.isArray(list) ? list : [];
}

export default async function ExpiryRequestsPage() {
  await requireAuth();
  const requests = await fetchExpiryRequests("pending");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Document expiry update requests</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Drivers submit new licence/PRDP/medical expiry dates with supporting documents. Review and approve or reject below.
      </p>
      <ExpiryRequestsClient requests={requests} />
    </div>
  );
}


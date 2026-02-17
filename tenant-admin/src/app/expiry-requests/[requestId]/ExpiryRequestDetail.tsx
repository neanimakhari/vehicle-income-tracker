"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Check, X } from "lucide-react";

type Request = {
  id: string;
  userId: string;
  status: string;
  requestedLicenseExpiry: string | null;
  requestedPrdpExpiry: string | null;
  requestedMedicalCertificateExpiry: string | null;
  supportingDocumentIds: string[] | null;
  submittedAt: string;
};

type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  licenseExpiry?: string | null;
  prdpExpiry?: string | null;
  medicalCertificateExpiry?: string | null;
} | null;

type Doc = { id: string; documentType: string; fileName: string; createdAt: string };

type Props = {
  request: Request;
  profile: Profile;
  supportingDocs: Doc[];
  approveRequest: () => Promise<{ success: boolean; error?: string }>;
  rejectRequest: (reason?: string) => Promise<{ success: boolean; error?: string }>;
};

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return String(d);
  }
}

export function ExpiryRequestDetail({
  request,
  profile,
  supportingDocs,
  approveRequest,
  rejectRequest,
}: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const driverName = profile
    ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || profile.id
    : request.userId;

  async function handleApprove() {
    setActionLoading("approve");
    setMessage(null);
    const result = await approveRequest();
    setActionLoading(null);
    if (result.success) {
      setMessage({ type: "success", text: "Request approved. Driver profile has been updated." });
      router.refresh();
      router.push("/expiry-requests");
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to approve" });
    }
  }

  async function handleReject() {
    setActionLoading("reject");
    setMessage(null);
    const result = await rejectRequest(rejectReason.trim() || undefined);
    setActionLoading(null);
    if (result.success) {
      setMessage({ type: "success", text: "Request rejected." });
      router.refresh();
      router.push("/expiry-requests");
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to reject" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Expiry update request</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Driver: <strong>{driverName}</strong> · Submitted {new Date(request.submittedAt).toLocaleString()}
      </p>

      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === "success"
              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="font-medium mb-3">Current vs requested dates</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="pb-2 pr-4">Document</th>
              <th className="pb-2 pr-4">Current expiry</th>
              <th className="pb-2">Requested expiry</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <td className="py-2 pr-4">Driver&apos;s licence</td>
              <td className="py-2 pr-4">{fmt(profile?.licenseExpiry)}</td>
              <td className="py-2">{fmt(request.requestedLicenseExpiry)}</td>
            </tr>
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <td className="py-2 pr-4">PRDP certificate</td>
              <td className="py-2 pr-4">{fmt(profile?.prdpExpiry)}</td>
              <td className="py-2">{fmt(request.requestedPrdpExpiry)}</td>
            </tr>
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <td className="py-2 pr-4">Medical certificate</td>
              <td className="py-2 pr-4">{fmt(profile?.medicalCertificateExpiry)}</td>
              <td className="py-2">{fmt(request.requestedMedicalCertificateExpiry)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="font-medium mb-3">Supporting documents</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          Review these documents before approving. Download to verify.
        </p>
        {supportingDocs.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">No documents attached.</p>
        ) : (
          <ul className="space-y-2">
            {supportingDocs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between text-sm">
                <span>
                  {doc.documentType} — {doc.fileName}
                </span>
                <a
                  href={`/api/drivers/${request.userId}/documents/${doc.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-4">
        <button
          type="button"
          onClick={handleApprove}
          disabled={actionLoading !== null}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {actionLoading === "approve" ? (
            "Approving..."
          ) : (
            <>
              <Check className="h-4 w-4" />
              Approve
            </>
          )}
        </button>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rejection reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm w-64"
          />
          <button
            type="button"
            onClick={handleReject}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {actionLoading === "reject" ? "Rejecting..." : <><X className="h-4 w-4" /> Reject</>}
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        <Link href={`/drivers/${request.userId}`} className="text-primary hover:underline">
          View full driver profile
        </Link>
      </p>
    </div>
  );
}


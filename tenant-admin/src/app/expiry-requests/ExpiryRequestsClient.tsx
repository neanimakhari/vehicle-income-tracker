"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

type RequestRow = {
  id: string;
  userId: string;
  status: string;
  requestedLicenseExpiry: string | null;
  requestedPrdpExpiry: string | null;
  requestedMedicalCertificateExpiry: string | null;
  submittedAt: string;
  driverName?: string;
};

type Props = {
  requests: RequestRow[];
};

export function ExpiryRequestsClient({ requests }: Props) {
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-600 dark:text-zinc-400">
        No pending expiry update requests.
      </div>
    );
  }

  return (
    <div className="table-responsive rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-800/50">
          <tr>
            <th className="text-left p-3 font-medium whitespace-nowrap">Driver</th>
            <th className="text-left p-3 font-medium whitespace-nowrap">Submitted</th>
            <th className="text-left p-3 font-medium whitespace-nowrap">Requested dates</th>
            <th className="text-left p-3 font-medium w-24 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="p-3 whitespace-nowrap">{req.driverName ?? req.userId}</td>
              <td className="p-3 whitespace-nowrap">{new Date(req.submittedAt).toLocaleString()}</td>
              <td className="p-3 whitespace-nowrap">
                {[req.requestedLicenseExpiry, req.requestedPrdpExpiry, req.requestedMedicalCertificateExpiry]
                  .filter(Boolean)
                  .map((d) => (d ? new Date(d).toLocaleDateString() : null))
                  .filter(Boolean)
                  .join(", ") || "—"}
              </td>
              <td className="p-3 whitespace-nowrap">
                <Link
                  href={`/expiry-requests/${req.id}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



import { requireAuth } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { AuditLogTable } from "./audit-log-table";
import { FileText } from "lucide-react";

type AuditEntry = {
  id: string;
  action: string;
  actorUserId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

async function fetchAuditLogs(): Promise<AuditEntry[]> {
  const logs = await fetchJson<AuditEntry[]>("/tenant/audit");
  return Array.isArray(logs) ? logs : [];
}

export default async function AuditPage() {
  await requireAuth();
  const logs = await fetchAuditLogs();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg">
          <FileText className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
            Audit Trail
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Who changed what and when
          </p>
        </div>
      </div>

      <AuditLogTable initialLogs={logs} />
    </div>
  );
}

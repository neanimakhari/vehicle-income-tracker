import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "@/lib/api";
import { AnnouncementClient } from "./AnnouncementClient";

type Announcement = {
  enabled: boolean;
  severity: "info" | "maintenance";
  message: string;
  startsAt: string | null;
  endsAt: string | null;
  blockWrites: boolean;
};

export default async function AnnouncementPage() {
  await requireAuth();
  const data = (await fetchJson<Announcement>("/platform/announcement")) ?? {
    enabled: false,
    severity: "info" as const,
    message: "",
    startsAt: null,
    endsAt: null,
    blockWrites: false,
  };

  async function save(patch: Partial<Announcement>) {
    "use server";
    const res = await fetch(`${getApiUrl()}/platform/announcement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, error: body.message ?? "Failed to save" };
    }
    revalidatePath("/announcement");
    return { ok: true as const, data: body as Announcement };
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
          Announcement banner
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Shown on vit-admin when enabled and within the schedule window.
        </p>
      </div>
      <AnnouncementClient initial={data} save={save} />
    </div>
  );
}

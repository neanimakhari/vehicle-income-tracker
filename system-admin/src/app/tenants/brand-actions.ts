"use server";

import { getApiUrl, getAuthHeaders } from "@/lib/api";

async function api(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    ...(await getAuthHeaders()),
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (init?.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Request failed (${res.status})`;
    return { ok: false as const, error: msg, data: null };
  }
  return { ok: true as const, error: null, data };
}

export async function brandGetStudio(tenantId: string) {
  return api(`/tenants/${tenantId}/brand`);
}

export async function brandSaveDraft(
  tenantId: string,
  body: {
    displayName?: string | null;
    primaryHex?: string | null;
    accentHex?: string | null;
    sidebarStyle?: "colored" | "neutral";
  },
) {
  return api(`/tenants/${tenantId}/brand/draft`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function brandPublish(tenantId: string) {
  return api(`/tenants/${tenantId}/brand/publish`, { method: "POST" });
}

export async function brandReset(tenantId: string, wipeDraft = false) {
  return api(`/tenants/${tenantId}/brand/reset`, {
    method: "POST",
    body: JSON.stringify({ wipeDraft }),
  });
}

export async function brandUploadLogo(tenantId: string, formData: FormData) {
  return api(`/tenants/${tenantId}/brand/logo`, {
    method: "POST",
    body: formData,
  });
}

export async function brandListKits() {
  return api(`/brand-kits`);
}

export async function brandSaveKit(
  tenantId: string,
  body: { name: string; includeLogo?: boolean },
) {
  return api(`/tenants/${tenantId}/brand/save-kit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function brandApplyKit(
  tenantId: string,
  kitId: string,
  opts: { includeLogo?: boolean; setDisplayName?: boolean; publish?: boolean },
) {
  return api(`/tenants/${tenantId}/brand/apply-kit/${kitId}`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

export async function brandListSnapshots(tenantId: string) {
  return api(`/tenants/${tenantId}/brand/snapshots`);
}

export async function brandSaveSnapshot(tenantId: string, label: string) {
  return api(`/tenants/${tenantId}/brand/snapshots`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function brandRestoreSnapshot(tenantId: string, snapshotId: string) {
  return api(`/tenants/${tenantId}/brand/snapshots/${snapshotId}/restore`, {
    method: "POST",
  });
}

export async function brandCreatePreview(tenantId: string, source = "draft") {
  return api(`/tenants/${tenantId}/brand/preview-tokens`, {
    method: "POST",
    body: JSON.stringify({ source, days: 7 }),
  });
}

export async function brandListPreviewTokens(tenantId: string) {
  return api(`/tenants/${tenantId}/brand/preview-tokens`);
}

export async function brandResolvePreview(token: string) {
  const res = await fetch(`${getApiUrl()}/public/brand-preview/${token}`, {
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Request failed (${res.status})`;
    return { ok: false as const, error: msg, data: null };
  }
  return { ok: true as const, error: null, data };
}

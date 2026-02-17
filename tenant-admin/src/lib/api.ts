import { getAuthToken, getTenantSlug } from "./auth";

const baseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export function getApiUrl(): string {
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/v1`;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = (await getAuthToken()) ?? "";
  const tenant = (await getTenantSlug()) ?? "";
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenant) {
    headers["X-Tenant-Id"] = tenant;
  }
  return headers;
}

export async function fetchJson<T>(path: string) {
  try {
    const res = await fetch(`${getApiUrl()}${path}`, {
      cache: "no-store",
      headers: {
        ...(await getAuthHeaders()),
      },
    });

    if (!res.ok) {
      // Auto-logout on 401 (Unauthorized) - token expired
      if (res.status === 401) {
        const { clearAuthSession } = await import("./auth");
        await clearAuthSession();
        const { redirect } = await import("next/navigation");
        redirect("/login?error=expired");
      }
      console.error(`API Error: ${res.status} ${res.statusText} for ${path}`);
      try {
        const errorText = await res.text();
        console.error(`Error response: ${errorText}`);
      } catch (e) {
        console.error('Could not read error response body');
      }
      return null;
    }

    try {
      return (await res.json()) as T;
    } catch (jsonError) {
      console.error(`JSON parse error for ${path}:`, jsonError);
      return null;
    }
  } catch (error) {
    console.error(`Fetch error for ${path}:`, error);
    return null;
  }
}


import { getAuthToken } from "./auth";
import { getApiUrl as getApiUrlBase } from "./api-url";

export const getApiUrl = getApiUrlBase;

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = (await getAuthToken()) ?? "";
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
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
        const { clearAuthToken } = await import("./auth");
        await clearAuthToken();
        const { redirect } = await import("next/navigation");
        redirect("/login?error=expired");
      }
      // 403 = wrong role (e.g. tenant admin viewing platform-only page)
      if (res.status === 403) {
        const { clearAuthToken } = await import("./auth");
        await clearAuthToken();
        const { redirect } = await import("next/navigation");
        redirect("/login?error=forbidden");
      }
      console.error(`API Error: ${res.status} ${res.statusText} for ${path}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (error) {
    console.error(`Fetch error for ${path}:`, error);
    return null;
  }
}


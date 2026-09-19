import { redirect } from "next/navigation";
import { clearAuthToken, getAuthToken } from "./auth";
import { getApiUrl as getApiUrlBase } from "./api-url";

export const getApiUrl = getApiUrlBase;

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

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
      // Token expired / invalid — clear cookie first or middleware loops login↔home
      if (res.status === 401) {
        await clearAuthToken();
        redirect("/login?error=expired");
      }
      // 403 = not entitled for this endpoint; do not wipe the session (SYS hits some admin-only routes)
      if (res.status === 403) {
        console.error(`API Error: ${res.status} ${res.statusText} for ${path}`);
        return null;
      }
      console.error(`API Error: ${res.status} ${res.statusText} for ${path}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error(`Fetch error for ${path}:`, error);
    return null;
  }
}

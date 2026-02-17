const DEFAULT_API_URL = "http://localhost:3000";

function getBase(): string {
  if (typeof window !== "undefined") {
    return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).trim();
  }
  return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).trim();
}

/**
 * API base URL including /v1 prefix. Server: API_URL; Client: NEXT_PUBLIC_API_URL.
 */
export function getApiUrl(): string {
  const base = getBase();
  return base.endsWith("/v1") ? base : `${base.replace(/\/$/, "")}/v1`;
}

export async function fetchJsonClient<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> || {}),
    };
    const res = await fetch(`${getApiUrl()}${path}`, { cache: "no-store", ...options, headers });
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = "/login";
        return null;
      }
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * API base URL only. Safe to import from Client Components.
 * Server-side: use API_URL (e.g. http://api:3000 in Docker) so the container can reach the API.
 * Client-side: API_URL is not exposed; NEXT_PUBLIC_API_URL is used (e.g. http://localhost:3000).
 */
const baseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export function getApiUrl(): string {
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/v1`;
}

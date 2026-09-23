"use server";

import { revalidatePath } from "next/cache";

/** Bust Next cache so Health re-fetches /platform/ops/host. */
export async function refreshHealthPage(): Promise<{ ok: true; at: string }> {
  revalidatePath("/health");
  revalidatePath("/health", "page");
  revalidatePath("/", "layout");
  return { ok: true, at: new Date().toISOString() };
}

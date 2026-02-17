"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function clearPlatformAdminCache(): Promise<never> {
  revalidatePath("/", "layout");
  revalidatePath("/tenants");
  revalidatePath("/health");
  revalidatePath("/alerts");
  revalidatePath("/defaults");
  revalidatePath("/audit");
  revalidatePath("/platform-admins");
  revalidatePath("/tenant-admins");
  revalidatePath("/mfa");
  redirect("/health?cleared=1");
}

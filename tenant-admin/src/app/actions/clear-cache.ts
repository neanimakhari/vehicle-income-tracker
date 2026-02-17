"use server";

import { revalidatePath } from "next/cache";

export async function clearTenantAdminCache(): Promise<void> {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/drivers");
  revalidatePath("/vehicles");
  revalidatePath("/incomes");
  revalidatePath("/expenses");
  revalidatePath("/maintenance");
  revalidatePath("/reports");
  revalidatePath("/audit");
}

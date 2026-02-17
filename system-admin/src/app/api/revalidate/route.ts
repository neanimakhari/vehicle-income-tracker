import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/revalidate?secret=REVALIDATE_SECRET
 * Clears Next.js caches for the platform admin app.
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }
  try {
    revalidatePath("/", "layout");
    revalidatePath("/tenants");
    revalidatePath("/health");
    revalidatePath("/alerts");
    revalidatePath("/defaults");
    revalidatePath("/audit");
    revalidatePath("/platform-admins");
    revalidatePath("/tenant-admins");
    revalidatePath("/mfa");
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (e) {
    console.error("Revalidate error:", e);
    return NextResponse.json({ error: "Revalidate failed" }, { status: 500 });
  }
}

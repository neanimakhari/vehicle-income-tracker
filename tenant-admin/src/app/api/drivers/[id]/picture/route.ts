import { NextRequest, NextResponse } from "next/server";
import { getApiUrl, getAuthHeaders } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing driver id" }, { status: 400 });
  }
  try {
    const res = await fetch(`${getApiUrl()}/tenant/drivers/${id}/profile/picture`, {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("Error proxying driver picture:", e);
    return new NextResponse(null, { status: 500 });
  }
}

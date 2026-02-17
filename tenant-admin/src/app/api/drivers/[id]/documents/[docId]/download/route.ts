import { NextResponse } from "next/server";
import { getApiUrl, getAuthHeaders } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  if (!id || !docId) {
    return NextResponse.json({ error: "Missing id or docId" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${getApiUrl()}/tenant/drivers/${id}/documents/${docId}/download`,
      { headers: await getAuthHeaders() }
    );
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const disposition = res.headers.get("content-disposition") ?? `attachment`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
      },
    });
  } catch (e) {
    console.error("Error proxying driver document download:", e);
    return new NextResponse(null, { status: 500 });
  }
}


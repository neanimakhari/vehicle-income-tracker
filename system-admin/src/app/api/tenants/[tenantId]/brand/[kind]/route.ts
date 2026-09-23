import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/api-url";

type AssetKind = "logo-file" | "login-bg-file";

async function proxyBrandAsset(
  tenantId: string,
  kind: AssetKind,
  request: NextRequest,
) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const v = request.nextUrl.searchParams.get("v");
  const qs = v ? `?v=${encodeURIComponent(v)}` : "";
  const upstream = await fetch(
    `${getApiUrl()}/tenants/${encodeURIComponent(tenantId)}/brand/${kind}${qs}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text || "Asset unavailable", {
      status: upstream.status,
    });
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  const contentType = upstream.headers.get("content-type") || "image/png";
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantId: string; kind: string }> },
) {
  const { tenantId, kind } = await context.params;
  if (kind !== "logo-file" && kind !== "login-bg-file") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return proxyBrandAsset(tenantId, kind, request);
}

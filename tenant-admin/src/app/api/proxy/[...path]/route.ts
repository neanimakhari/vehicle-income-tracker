"use server";

import { NextRequest, NextResponse } from "next/server";
import { getApiUrl, getAuthHeaders } from "@/lib/api";

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const targetPath = `/${path.join("/")}`;
  const targetUrl = `${getApiUrl()}${targetPath}${req.nextUrl.search}`;

  const authHeaders = await getAuthHeaders();

  // Only forward safe / required headers; add auth + tenant
  const contentType = req.headers.get("content-type") ?? undefined;
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const res = await fetch(targetUrl, {
    method,
    headers,
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  });

  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8",
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, ctx);
}


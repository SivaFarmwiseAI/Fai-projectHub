/**
 * Catch-all proxy route — forwards all /api/* requests to the Python backend.
 * Handles cookie forwarding for JWT auth.
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL || "http://localhost:8000";

async function proxy(req: NextRequest): Promise<NextResponse> {
  // Build backend URL: strip the Next.js /api prefix and add it back for Python
  const { pathname, search } = req.nextUrl;
  const backendUrl = `${BACKEND}${pathname}${search}`;

  // Forward cookies
  const cookieHeader = req.headers.get("cookie") || "";

  // Forward body for mutating methods
  let body: BodyInit | null = null;
  if (!["GET", "HEAD", "DELETE"].includes(req.method)) {
    body = await req.text();
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      method: req.method,
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        cookie: cookieHeader,
        "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
      },
      ...(body !== null ? { body } : {}),
    });
  } catch (err) {
    console.error("[proxy] Backend unreachable:", err);
    return NextResponse.json({ error: "Backend service unavailable" }, { status: 503 });
  }

  const responseBody = await backendRes.text();
  const headers = new Headers();

  // Forward content-type
  const ct = backendRes.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  // Forward Set-Cookie header (auth token)
  const setCookie = backendRes.headers.get("set-cookie");
  if (setCookie) headers.set("set-cookie", setCookie);

  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers,
  });
}

export const GET     = proxy;
export const POST    = proxy;
export const PATCH   = proxy;
export const PUT     = proxy;
export const DELETE  = proxy;
export const OPTIONS = proxy;

export const dynamic = "force-dynamic";

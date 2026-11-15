import { NextResponse, type NextRequest } from "next/server";
import { publicAccessPaused } from "@/lib/public-access";
import { maintenanceHtml } from "@/lib/maintenance-html";

export function proxy(request: NextRequest) {
  if (!publicAccessPaused()) return NextResponse.next();
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (request.nextUrl.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
    return NextResponse.json({ message: "Работа с аккаунтами временно приостановлена." }, { status: 503, headers });
  }
  const pathname = request.nextUrl.pathname;
  if (pathname === "/privacy" || pathname === "/maintenance/index.html" || pathname === "/favicon.ico" || pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/")) return NextResponse.next();
  return new NextResponse(maintenanceHtml, { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
}

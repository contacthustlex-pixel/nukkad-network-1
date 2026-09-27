import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PATH = process.env.ADMIN_PANEL_PATH || "nukkad-ops";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

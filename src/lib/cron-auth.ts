import { NextResponse } from "next/server";

type CronOptions = {
  /** Allow logged-in admin to trigger from ops panel without CRON_SECRET. */
  allowAdmin?: boolean;
};

/** When CRON_SECRET is set, require Bearer token or (optionally) admin bypass. */
export function assertCronAuthorized(request: Request, options?: CronOptions): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token === secret) return null;
  if (options?.allowAdmin) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

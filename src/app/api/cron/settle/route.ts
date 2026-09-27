import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";
import { sendTemplate } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const jar = await cookies();
  const isAdmin = Boolean(readAdmin(jar.get("nk_admin")?.value));
  const denied = assertCronAuthorized(request, { allowAdmin: isAdmin });
  if (denied) return denied;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("settle_week");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    await sendTemplate("T5", String(row.phone ?? ""), {
      business: String(row.business_name ?? ""),
      net_due: String(row.net_due ?? ""),
      week_start: String(row.week_start ?? ""),
      week_end: String(row.week_end ?? ""),
    });
  }
  return NextResponse.json({ ok: true, settlements: rows.length });
}

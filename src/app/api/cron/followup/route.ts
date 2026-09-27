import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { loadReferralCustomerRows } from "@/lib/referrals";
import { getFollowupAuto } from "@/lib/settings";
import { FOLLOWUP_PROMPT } from "@/lib/site-url";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";
import { sendSession, sendTemplate } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const jar = await cookies();
  const isAdmin = Boolean(readAdmin(jar.get("nk_admin")?.value));
  const denied = assertCronAuthorized(request, { allowAdmin: isAdmin });
  if (denied) return denied;

  const supabase = createServiceClient();
  const auto = await getFollowupAuto(supabase);
  if (!auto && !isAdmin) {
    return NextResponse.json({ ok: true, skipped: true, reason: "followup_auto off" });
  }

  const rows = await loadReferralCustomerRows(supabase);
  const pending = rows.filter((row) => !row.redeemed && row.activeCode);

  for (const row of pending) {
    await sendTemplate("T4", row.phone, { name: row.name, code: row.activeCode ?? "" });
    await sendSession(row.phone, FOLLOWUP_PROMPT);
  }

  return NextResponse.json({ ok: true, sent: pending.length });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readPartner, readAdmin } from "@/lib/session";
import { loadReferralCustomerRows } from "@/lib/referrals";
import { createServiceClient } from "@/lib/supabase-server";
import { FOLLOWUP_PROMPT } from "@/lib/site-url";
import { sendSession } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sourceBusinessId = body?.source_business_id ? String(body.source_business_id) : undefined;

  const jar = await cookies();
  const partnerId = readPartner(jar.get("nk_partner")?.value);
  const isAdmin = readAdmin(jar.get("nk_admin")?.value);
  if (!isAdmin && !partnerId) {
    return NextResponse.json({ error: "Login karo" }, { status: 401 });
  }

  const filterId = isAdmin ? sourceBusinessId : partnerId ?? undefined;
  const supabase = createServiceClient();
  const rows = await loadReferralCustomerRows(supabase, { sourceBusinessId: filterId });
  const pending = rows.filter((row) => !row.redeemed);

  for (const row of pending) {
    await sendSession(row.phone, FOLLOWUP_PROMPT);
  }

  return NextResponse.json({ ok: true, sent: pending.length });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST() {
  const jar = await cookies();
  const businessId = readPartner(jar.get("nk_partner")?.value);
  if (!businessId) return NextResponse.json({ error: "Login karo" }, { status: 401 });
  const supabase = createServiceClient();
  await supabase.rpc("mark_chain_notification_seen", { business_id: businessId });
  return NextResponse.json({ ok: true });
}

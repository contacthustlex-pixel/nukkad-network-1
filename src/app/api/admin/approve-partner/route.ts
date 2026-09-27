import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";
import { APPROVAL_TIERS } from "@/lib/tiers";

export async function POST(request: Request) {
  const jar = await cookies();
  if (!readAdmin(jar.get("nk_admin")?.value)) {
    return NextResponse.json({ error: "Admin login karo" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  const tier = String(body?.tier ?? "").toLowerCase();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!APPROVAL_TIERS.includes(tier as (typeof APPROVAL_TIERS)[number])) {
    return NextResponse.json({ error: "Tier select karo" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("approve_pending_business", {
    p_business_id: id,
    p_tier: tier,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

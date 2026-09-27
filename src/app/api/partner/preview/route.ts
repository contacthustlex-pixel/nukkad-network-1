import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const jar = await cookies();
  const businessId = readPartner(jar.get("nk_partner")?.value);
  if (!businessId) return NextResponse.json({ error: "Login karo" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("preview_redeem", { code, business_id: businessId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

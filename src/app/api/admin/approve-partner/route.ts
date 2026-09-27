import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const jar = await cookies();
  if (!readAdmin(jar.get("nk_admin")?.value)) {
    return NextResponse.json({ error: "Admin login karo" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("approve_partner_application", { app_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

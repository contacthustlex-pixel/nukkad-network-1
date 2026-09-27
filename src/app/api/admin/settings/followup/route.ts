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
  const enabled = Boolean(body?.enabled);

  const supabase = createServiceClient();
  const { error } = await supabase.rpc("set_setting", {
    setting_key: "followup_auto",
    setting_value: enabled,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, followup_auto: enabled });
}

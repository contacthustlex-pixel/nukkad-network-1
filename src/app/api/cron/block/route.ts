import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const jar = await cookies();
  const isAdmin = Boolean(readAdmin(jar.get("nk_admin")?.value));
  const denied = assertCronAuthorized(request, { allowAdmin: isAdmin });
  if (denied) return denied;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("block_unpaid");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, blocked: data });
}

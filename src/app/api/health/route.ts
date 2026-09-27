import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true });

  if (error || count == null) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "count failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, businesses: count });
}

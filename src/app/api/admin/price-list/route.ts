import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const jar = await cookies();
  if (!readAdmin(jar.get("nk_admin")?.value)) {
    return NextResponse.json({ error: "Admin login karo" }, { status: 401 });
  }
  const path = new URL(request.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from("price-lists").createSignedUrl(path, 600);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ url: data.signedUrl });
}

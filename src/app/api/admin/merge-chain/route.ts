import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";
import { sendSession } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const jar = await cookies();
  if (!readAdmin(jar.get("nk_admin")?.value)) {
    return NextResponse.json({ error: "Admin login karo" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const businessIds = Array.isArray(body?.business_ids) ? body.business_ids.map(String) : [];
  if (!name || businessIds.length < 2) {
    return NextResponse.json({ error: "Chain name + kam se kam 2 partners" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("merge_businesses_into_chain", {
    chain_name: name,
    business_ids: businessIds,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const partners = (data?.partners as { phone?: string; name?: string }[]) ?? [];
  for (const partner of partners) {
    if (partner.phone) {
      await sendSession(
        partner.phone,
        `Nukkad Network: Aap chain "${name}" mein merge ho gaye. Partner login → QR download karke customer ko scan karwao.`,
      );
    }
  }

  return NextResponse.json(data);
}

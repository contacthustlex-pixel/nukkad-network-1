import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";
import { sendTemplate } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const jar = await cookies();
  const businessId = readPartner(jar.get("nk_partner")?.value);
  if (!businessId) return NextResponse.json({ error: "Login karo" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const gross = Number(body?.gross);
  const isNew = Boolean(body?.is_new);
  if (!code || !Number.isFinite(gross) || gross <= 0) {
    return NextResponse.json({ error: "Code aur bill daalo" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: codes } = await supabase.from("referral_codes").select("customer_id").eq("code", code).limit(1);
  const customerId = codes?.[0]?.customer_id as string | undefined;

  const { data, error } = await supabase.rpc("redeem_code", {
    code,
    business_id: businessId,
    gross,
    is_new: isNew,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let phone = "";
  if (customerId) {
    const { data: customers } = await supabase.from("customers").select("phone").eq("id", customerId).limit(1);
    phone = customers?.[0]?.phone ?? "";
  }
  await sendTemplate("T2", phone, {
    code,
    next_code: String(data?.next_code ?? ""),
    discount: String(data?.discount ?? ""),
    net_payable: String(data?.net_payable ?? ""),
  });

  return NextResponse.json(data);
}

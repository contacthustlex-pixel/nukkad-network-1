import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(request: Request) {
  const jar = await cookies();
  const businessId = readPartner(jar.get("nk_partner")?.value);
  if (!businessId) return NextResponse.json({ error: "Login karo" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  const gross = Number(body?.gross);
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("preview_redeem", { code, business_id: businessId });
  if (error) return NextResponse.json({ error: "Code not valid" }, { status: 400 });

  if (Number.isFinite(gross) && gross > 0) {
    const discount = Math.min(
      money((gross * Number(data.discount_pct)) / 100),
      Number(data.discount_cap),
    );
    const payable = money(gross - discount);
    return NextResponse.json({
      ...data,
      discount,
      net_payable: payable,
      valid_message: `Code valid. Total ₹${gross} → ab ₹${payable} (${data.discount_pct}% discount).`,
    });
  }

  return NextResponse.json(data);
}

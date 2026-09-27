import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { createServiceClient } from "@/lib/supabase-server";
import { sendTemplate } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = String(body?.phone ?? "");
  const name = String(body?.name ?? "").trim();
  const businessId = String(body?.business_id ?? "");
  const otp = String(body?.otp ?? "");
  if (!/^\d{10}$/.test(phone) || !name || !businessId || !/^\d{4}$/.test(otp)) {
    return NextResponse.json({ error: "Naam, phone aur OTP check karo" }, { status: 400 });
  }

  try {
    const valid = await verifyOtp(phone, otp);
    if (!valid) {
      return NextResponse.json({ error: "OTP galat hai ya expire ho gaya" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("issue_code", {
      phone,
      name,
      business_id: businessId,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await sendTemplate("T1", phone, {
      name,
      code: String(data?.code ?? ""),
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Code failed" },
      { status: 500 },
    );
  }
}

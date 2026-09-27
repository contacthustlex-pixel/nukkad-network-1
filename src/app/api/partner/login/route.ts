import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { partnerCookieName, signPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = String(body?.phone ?? "");
  const otp = String(body?.otp ?? "");
  if (!/^\d{10}$/.test(phone) || !/^\d{4}$/.test(otp)) {
    return NextResponse.json({ error: "Phone aur OTP check karo" }, { status: 400 });
  }

  const valid = await verifyOtp(phone, otp);
  if (!valid) {
    return NextResponse.json({ error: "OTP galat hai ya expire ho gaya" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("businesses").select("id,name,status").eq("phone", phone).limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const business = data?.[0];
  if (!business) return NextResponse.json({ error: "Yeh number kisi shop ka nahi hai" }, { status: 404 });
  if (business.status === "pending") {
    return NextResponse.json({ error: "Admin abhi approve nahi kiya. Thodi der ruko." }, { status: 403 });
  }
  if (business.status === "rejected") {
    return NextResponse.json({ error: "Yeh application reject ho chuki hai." }, { status: 403 });
  }
  if (business.status === "banned") {
    return NextResponse.json({ error: "Shop banned hai." }, { status: 403 });
  }

  const response = NextResponse.json({ id: business.id, name: business.name, status: business.status });
  response.cookies.set(partnerCookieName(), signPartner(business.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}

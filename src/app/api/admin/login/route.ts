import { NextResponse } from "next/server";
import { signAdmin } from "@/lib/session";
import { verifyOtp } from "@/lib/otp";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = String(body?.phone ?? "");
  const otp = String(body?.otp ?? "");
  const adminPhone = process.env.ADMIN_PHONE ?? "";
  if (phone !== adminPhone) {
    return NextResponse.json({ error: "Yeh admin number nahi hai" }, { status: 403 });
  }
  const valid = await verifyOtp(phone, otp);
  if (!valid) return NextResponse.json({ error: "OTP galat hai" }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("nk_admin", signAdmin(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return response;
}

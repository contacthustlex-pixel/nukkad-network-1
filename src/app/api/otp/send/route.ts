import { NextResponse } from "next/server";
import { sendOtp } from "@/lib/otp";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = String(body?.phone ?? "");
  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "10 digit phone daalo" }, { status: 400 });
  }
  try {
    await sendOtp(phone);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OTP failed" },
      { status: 500 },
    );
  }
}

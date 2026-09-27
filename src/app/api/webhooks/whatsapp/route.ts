import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { sendSession } from "@/lib/whatsapp";

function originFrom(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const from = String(body?.from ?? "");
  const text = String(body?.text ?? "").toLowerCase();
  if (!from) {
    return NextResponse.json({ error: "from required" }, { status: 400 });
  }

  const origin = originFrom(request);
  const supabase = createServiceClient();
  let reply: string;

  if (text.includes("code")) {
    const { data, error } = await supabase.rpc("get_active_code", { phone: from });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reply = data?.code
      ? `Aapka code ${data.code}. Shops: ${origin}/shops?c=${data.code}`
      : `Pehle shop QR se register karo: ${origin}`;
  } else if (text.includes("shops")) {
    const { data } = await supabase.rpc("get_active_code", { phone: from });
    reply = data?.code
      ? `${origin}/shops?c=${data.code}`
      : `Pehle code lo: ${origin}`;
  } else   if (text.includes("complaint")) {
    reply = "Complaint ke liye receipt wale link par jao: /complaint/<id>. Hum 48 ghante mein verify karenge.";
  } else if (["visited", "busy", "expensive", "forgot", "behaviour"].includes(text.trim())) {
    const { error } = await supabase.rpc("record_followup", { phone: from, reply: text.trim() });
    reply = error ? "Reply save nahi hui. Dubara try karo." : "Dhanyavaad — reply save ho gaya.";
  } else {
    reply = "Menu: code · shops · complaint";
  }

  await sendSession(from, reply);
  return NextResponse.json({ reply });
}

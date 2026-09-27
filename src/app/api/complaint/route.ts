import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const redemptionId = String(body?.redemption_id ?? "");
  const reason = String(body?.reason ?? "").trim();
  const proofUrl = body?.proof_url ? String(body.proof_url).trim() : null;

  if (!redemptionId || !reason) {
    return NextResponse.json({ error: "Reason zaroori hai" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("file_dispute", {
    redemption_id: redemptionId,
    reason,
    proof_url: proofUrl ?? "",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

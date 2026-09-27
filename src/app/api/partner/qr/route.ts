import { cookies } from "next/headers";
import QRCode from "qrcode";
import { readPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const jar = await cookies();
  const businessId = readPartner(jar.get("nk_partner")?.value);
  if (!businessId) return new Response("Login karo", { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase.from("businesses").select("slug,name").eq("id", businessId).limit(1);
  const business = data?.[0];
  if (!business) return new Response("Shop nahi mili", { status: 404 });

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const png = await QRCode.toBuffer(`${origin}/r/${business.slug}`, { width: 640, margin: 2 });
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="${business.slug}-qr.png"`,
    },
  });
}

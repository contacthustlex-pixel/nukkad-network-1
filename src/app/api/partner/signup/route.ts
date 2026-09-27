import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const CUSTOMER_TYPES = new Set(["students", "families", "mixed"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const shopName = String(body?.shop_name ?? "").trim();
  const slug = String(body?.slug ?? "").trim();
  const phone = String(body?.phone ?? "");
  const ownerName = String(body?.owner_name ?? "").trim();
  const category = String(body?.category ?? "");
  const dailyFootfall = Number(body?.daily_footfall);
  const peakHours = String(body?.peak_hours ?? "").trim();
  const customerType = String(body?.customer_type ?? "").toLowerCase();

  if (!shopName || !slug || !/^\d{10}$/.test(phone) || !ownerName || !peakHours) {
    return NextResponse.json({ error: "Shop details check karo" }, { status: 400 });
  }
  if (!Number.isInteger(dailyFootfall) || dailyFootfall < 0) {
    return NextResponse.json({ error: "Daily footfall number daalo" }, { status: 400 });
  }
  if (!CUSTOMER_TYPES.has(customerType)) {
    return NextResponse.json({ error: "Customer type select karo" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: cats } = await supabase.from("categories").select("id").eq("name", category).limit(1);
  const categoryId = cats?.[0]?.id;
  if (!categoryId) return NextResponse.json({ error: "Category invalid" }, { status: 400 });

  const { data, error } = await supabase.rpc("submit_partner_application", {
    p_shop_name: shopName,
    p_slug: slug,
    p_phone: phone,
    p_owner_name: ownerName,
    p_category_id: categoryId,
    p_daily_footfall: dailyFootfall,
    p_peak_hours: peakHours,
    p_customer_type: customerType,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const shopName = String(body?.shop_name ?? "").trim();
  const slug = String(body?.slug ?? "").trim();
  const phone = String(body?.phone ?? "");
  const ownerName = String(body?.owner_name ?? "").trim();
  const category = String(body?.category ?? "");
  const monthlyRevenue = Number(body?.monthly_revenue);
  const avgOrderValue = Number(body?.avg_order_value);
  const dailyFootfall = Number(body?.daily_footfall);

  if (!shopName || !slug || !/^\d{10}$/.test(phone) || !ownerName) {
    return NextResponse.json({ error: "Shop details check karo" }, { status: 400 });
  }
  if (!Number.isFinite(monthlyRevenue) || !Number.isFinite(avgOrderValue) || !Number.isInteger(dailyFootfall)) {
    return NextResponse.json({ error: "Revenue / AOV / footfall numbers daalo" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: cats } = await supabase.from("categories").select("id").eq("name", category).limit(1);
  const categoryId = cats?.[0]?.id;
  if (!categoryId) return NextResponse.json({ error: "Category invalid" }, { status: 400 });

  const { data, error } = await supabase.rpc("submit_partner_application", {
    shop_name: shopName,
    slug,
    phone,
    owner_name: ownerName,
    category_id: categoryId,
    monthly_revenue: monthlyRevenue,
    avg_order_value: avgOrderValue,
    daily_footfall: dailyFootfall,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

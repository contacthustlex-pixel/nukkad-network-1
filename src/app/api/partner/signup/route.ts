import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { NUKKAD_AREAS } from "@/lib/locations";
import { createServiceClient } from "@/lib/supabase-server";

const CUSTOMER_TYPES = new Set(["students", "families", "mixed"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const shopName = String(form.get("shop_name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim();
  const phone = String(form.get("phone") ?? "");
  const ownerName = String(form.get("owner_name") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const dailyFootfall = Number(form.get("daily_footfall"));
  const peakHours = String(form.get("peak_hours") ?? "").trim();
  const customerType = String(form.get("customer_type") ?? "").toLowerCase();
  const pincode = String(form.get("pincode") ?? "").replace(/\D/g, "");
  const area = String(form.get("area") ?? "").trim();
  const address = String(form.get("address") ?? "").trim();
  const priceMin = Number(form.get("price_min"));
  const priceMax = Number(form.get("price_max"));
  const file = form.get("price_list");

  if (!shopName || !slug || !/^\d{10}$/.test(phone) || !ownerName || !peakHours || !address) {
    return NextResponse.json({ error: "Shop details check karo" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: "6 digit pincode daalo" }, { status: 400 });
  }
  if (!area || !NUKKAD_AREAS.includes(area as (typeof NUKKAD_AREAS)[number])) {
    return NextResponse.json({ error: "Area select karo" }, { status: 400 });
  }
  if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax) || priceMin < 0 || priceMax < priceMin) {
    return NextResponse.json({ error: "Sasti aur mehngi rate check karo" }, { status: 400 });
  }
  if (!Number.isInteger(dailyFootfall) || dailyFootfall < 0) {
    return NextResponse.json({ error: "Daily footfall number daalo" }, { status: 400 });
  }
  if (!CUSTOMER_TYPES.has(customerType)) {
    return NextResponse.json({ error: "Customer type select karo" }, { status: 400 });
  }

  const { latitude, longitude } = await geocodeAddress({ address, pincode, area });
  const supabase = createServiceClient();
  const { data: cats } = await supabase.from("categories").select("id").eq("name", category).limit(1);
  const categoryId = cats?.[0]?.id;
  if (!categoryId) return NextResponse.json({ error: "Category invalid" }, { status: 400 });

  let priceListPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Photo 5MB se chhoti honi chahiye" }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "pdf"].includes(ext) ? ext : "jpg";
    const folder = crypto.randomUUID();
    priceListPath = `${folder}/menu.${safeExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("price-lists").upload(priceListPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }
  }

  const { data, error } = await supabase.rpc("submit_partner_application", {
    p_shop_name: shopName,
    p_slug: slug,
    p_phone: phone,
    p_owner_name: ownerName,
    p_category_id: categoryId,
    p_daily_footfall: dailyFootfall,
    p_peak_hours: peakHours,
    p_customer_type: customerType,
    p_pincode: pincode,
    p_area: area,
    p_address: address,
    p_latitude: latitude,
    p_longitude: longitude,
    p_price_min: priceMin,
    p_price_max: priceMax,
    p_price_list_url: priceListPath,
  });

  if (error) {
    if (priceListPath) await supabase.storage.from("price-lists").remove([priceListPath]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

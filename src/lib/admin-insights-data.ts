import type { SupabaseClient } from "@supabase/supabase-js";

function weekLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
}

export async function loadAdminInsightSeries(supabase: SupabaseClient) {
  const [{ data: redemptions }, { data: businesses }, { data: categories }] = await Promise.all([
    supabase.from("redemptions").select("created_at,gross_bill,business_id").order("created_at", { ascending: false }).limit(2000),
    supabase.from("businesses").select("id,category_id").limit(500),
    supabase.from("categories").select("id,name").limit(20),
  ]);

  const categoryByBusiness = new Map((businesses ?? []).map((row) => [row.id as string, row.category_id as string]));
  const categoryNames = new Map((categories ?? []).map((row) => [row.id as string, row.name as string]));

  const weekly = new Map<string, { redemptions: number; gross: number; sort: number }>();
  const byCategory = new Map<string, number>();

  for (const row of redemptions ?? []) {
    const created = new Date(row.created_at as string);
    const start = new Date(created);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const key = start.toISOString().slice(0, 10);
    const bucket = weekly.get(key) ?? { redemptions: 0, gross: 0, sort: start.getTime() };
    bucket.redemptions += 1;
    bucket.gross += Number(row.gross_bill);
    weekly.set(key, bucket);

    const catId = categoryByBusiness.get(row.business_id as string);
    const catName = catId ? categoryNames.get(catId) ?? "Other" : "Other";
    byCategory.set(catName, (byCategory.get(catName) ?? 0) + 1);
  }

  const weeklySeries = [...weekly.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .slice(-8)
    .map(([key, value]) => ({
      label: weekLabel(new Date(key)),
      redemptions: value.redemptions,
      gross: Math.round(value.gross),
    }));

  const categorySeries = [...byCategory.entries()].map(([category, count]) => ({ category, count }));

  return { weekly: weeklySeries, byCategory: categorySeries };
}

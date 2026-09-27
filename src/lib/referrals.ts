import type { SupabaseClient } from "@supabase/supabase-js";

export type ReferralCustomerRow = {
  key: string;
  customerId: string;
  name: string;
  phone: string;
  sourceBusinessId: string;
  sourceBusinessName: string;
  activeCode: string | null;
  scannedAt: string;
  redeemed: boolean;
  redeemedAt: string | null;
  lastRedemptionId: string | null;
};

export async function loadReferralCustomerRows(
  supabase: SupabaseClient,
  options?: { sourceBusinessId?: string },
): Promise<ReferralCustomerRow[]> {
  const [{ data: customers }, { data: codes }, { data: redemptions }, { data: businesses }] =
    await Promise.all([
      supabase.from("customers").select("id,name,phone").limit(2000),
      supabase.from("referral_codes").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("redemptions").select("id,code_id,customer_id,created_at").limit(5000),
      supabase.from("businesses").select("id,name").limit(200),
    ]);

  const customerMap = new Map((customers ?? []).map((row) => [row.id as string, row]));
  const businessNames = new Map((businesses ?? []).map((row) => [row.id as string, row.name as string]));
  const codeById = new Map((codes ?? []).map((row) => [row.id as string, row]));

  const redemptionByCode = new Map<string, { id: string; created_at: string }>();
  for (const row of redemptions ?? []) {
    redemptionByCode.set(row.code_id as string, {
      id: row.id as string,
      created_at: row.created_at as string,
    });
  }

  const latestByPair = new Map<string, Record<string, unknown>>();
  for (const code of codes ?? []) {
    if (options?.sourceBusinessId && code.source_business_id !== options.sourceBusinessId) continue;
    const pair = `${code.customer_id}:${code.source_business_id}`;
    if (!latestByPair.has(pair)) latestByPair.set(pair, code);
  }

  const rows: ReferralCustomerRow[] = [];
  for (const [pair, latestCode] of latestByPair) {
    const customer = customerMap.get(latestCode.customer_id as string);
    if (!customer) continue;

    let redeemed = false;
    let redeemedAt: string | null = null;
    let lastRedemptionId: string | null = null;

    for (const code of codes ?? []) {
      if (code.customer_id !== latestCode.customer_id) continue;
      if (code.source_business_id !== latestCode.source_business_id) continue;
      const hit = redemptionByCode.get(code.id as string);
      if (hit) {
        redeemed = true;
        if (!redeemedAt || hit.created_at > redeemedAt) {
          redeemedAt = hit.created_at;
          lastRedemptionId = hit.id;
        }
      }
    }

    const activeForCustomer = (codes ?? []).find(
      (code) =>
        code.customer_id === latestCode.customer_id &&
        code.status === "active" &&
        new Date(code.expires_at as string).getTime() > Date.now(),
    );

    rows.push({
      key: pair,
      customerId: customer.id as string,
      name: (customer.name as string) || "Customer",
      phone: customer.phone as string,
      sourceBusinessId: latestCode.source_business_id as string,
      sourceBusinessName: businessNames.get(latestCode.source_business_id as string) || "Shop",
      activeCode: (activeForCustomer?.code as string) ?? null,
      scannedAt: latestCode.created_at as string,
      redeemed,
      redeemedAt,
      lastRedemptionId,
    });
  }

  return rows.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTier, type ShopTier } from "@/lib/tiers";

export type TierSuggestion = {
  suggested_tier: ShopTier;
  avg_bill: number;
  source: string;
};

export async function loadTierSuggestion(
  supabase: SupabaseClient,
  businessId: string,
): Promise<TierSuggestion | null> {
  const { data, error } = await supabase.rpc("suggest_tier", { p_business_id: businessId });
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const suggested = parseTier(String(row.suggested_tier ?? ""));
  if (!suggested) return null;
  return {
    suggested_tier: suggested,
    avg_bill: Number(row.avg_bill),
    source: String(row.source ?? ""),
  };
}

export async function signedPriceListUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("price-lists").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

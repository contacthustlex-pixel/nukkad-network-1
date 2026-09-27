export type ShopTier = "economy" | "mid" | "premium";

const TIER_RANK: Record<ShopTier, number> = {
  economy: 0,
  mid: 1,
  premium: 2,
};

export function parseTier(value: string | null | undefined): ShopTier | null {
  if (value === "economy" || value === "mid" || value === "premium") return value;
  return null;
}

export function tierBadge(tier: ShopTier | null | undefined): "E" | "M" | "P" | "—" {
  if (tier === "economy") return "E";
  if (tier === "mid") return "M";
  if (tier === "premium") return "P";
  return "—";
}

export function tierLabel(tier: ShopTier): string {
  if (tier === "economy") return "Economy";
  if (tier === "mid") return "Mid";
  return "Premium";
}

export function tiersCompatible(a: ShopTier | null, b: ShopTier | null): boolean {
  if (!a || !b) return false;
  return Math.abs(TIER_RANK[a] - TIER_RANK[b]) <= 1;
}

export const APPROVAL_TIERS: ShopTier[] = ["economy", "mid", "premium"];

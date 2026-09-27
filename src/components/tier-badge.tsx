import { tierBadge, type ShopTier } from "@/lib/tiers";

export function TierBadge({ tier, className = "" }: { tier: ShopTier | null | undefined; className?: string }) {
  const letter = tierBadge(tier);
  const title = tier ? tier : "Tier pending";
  return (
    <span
      title={title}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white ${className}`}
      aria-label={title}
    >
      {letter}
    </span>
  );
}

export function ShopNameWithTier({
  name,
  tier,
  className = "",
}: {
  name: string;
  tier: ShopTier | null | undefined;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <TierBadge tier={tier} />
      <span>{name}</span>
    </span>
  );
}

export const NUKKAD_AREAS = [
  "Mukherjee Nagar North",
  "Mukherjee Nagar South",
  "GTB Nagar",
  "Model Town",
  "Kamla Nagar",
  "Other",
] as const;

export type NukkadArea = (typeof NUKKAD_AREAS)[number];

/** Sort tier: lower = shown first (same pincode+area, then pincode, then area, then distance). */
export function shopLocationRank(
  shop: { pincode?: string | null; area?: string | null; latitude?: number | null; longitude?: number | null },
  source: { pincode?: string | null; area?: string | null; latitude?: number | null; longitude?: number | null },
): number {
  const samePin = source.pincode && shop.pincode === source.pincode;
  const sameArea = source.area && shop.area === source.area;
  if (samePin && sameArea) return 0;
  if (samePin) return 1;
  if (sameArea) return 2;

  const dist = haversineKm(source.latitude, source.longitude, shop.latitude, shop.longitude);
  if (dist != null) return 3 + dist;

  return 1000;
}

function haversineKm(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined,
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

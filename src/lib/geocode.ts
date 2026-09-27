/** Geocode shop address. Set GOOGLE_MAPS_GEOCODING_API_KEY for live Google Maps Geocoding. */
export async function geocodeAddress(input: {
  address: string;
  pincode: string;
  area: string;
}): Promise<{ latitude: number | null; longitude: number | null }> {
  const key = process.env.GOOGLE_MAPS_GEOCODING_API_KEY;
  const query = `${input.address}, ${input.area}, Delhi ${input.pincode}, India`;

  if (!key) {
    // TODO: add GOOGLE_MAPS_GEOCODING_API_KEY on Vercel for automatic lat/lng.
    return { latitude: null, longitude: null };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", key);

  const response = await fetch(url.toString());
  if (!response.ok) return { latitude: null, longitude: null };

  const body = (await response.json()) as {
    results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
  };
  const loc = body.results?.[0]?.geometry?.location;
  if (loc?.lat == null || loc?.lng == null) return { latitude: null, longitude: null };

  return { latitude: loc.lat, longitude: loc.lng };
}

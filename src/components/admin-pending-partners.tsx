"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ShopNameWithTier } from "@/components/tier-badge";
import { NUKKAD_AREAS } from "@/lib/locations";
import { APPROVAL_TIERS, tierLabel, type ShopTier } from "@/lib/tiers";

export type PendingPartner = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  owner_name: string | null;
  category: string;
  daily_footfall: number | null;
  peak_hours: string | null;
  customer_type: string | null;
  pincode: string | null;
  area: string | null;
  address: string | null;
  price_min: number | null;
  price_max: number | null;
  price_list_url: string | null;
  price_list_preview_url: string | null;
  created_at: string;
  suggestion: {
    suggested_tier: ShopTier;
    avg_bill: number;
    source: string;
  } | null;
};

export function AdminPendingPartners({ pending }: { pending: PendingPartner[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pincodeFilter, setPincodeFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [tierPick, setTierPick] = useState<Record<string, ShopTier | "">>({});

  const pincodes = useMemo(() => {
    const set = new Set(pending.map((row) => row.pincode).filter(Boolean) as string[]);
    return [...set].sort();
  }, [pending]);

  const filtered = useMemo(() => {
    return pending.filter((row) => {
      if (pincodeFilter && row.pincode !== pincodeFilter) return false;
      if (areaFilter && row.area !== areaFilter) return false;
      return true;
    });
  }, [pending, pincodeFilter, areaFilter]);

  async function approve(id: string) {
    const tier = tierPick[id];
    if (!tier) {
      setMessage("Approve se pehle tier select karo");
      return;
    }
    setMessage("");
    const response = await fetch("/api/admin/approve-partner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, tier }),
    });
    const body = await response.json();
    setMessage(response.ok ? `Approved ${body.slug} (${body.tier})` : body.error || "Fail");
    router.refresh();
  }

  async function rejectPartner(id: string) {
    setMessage("");
    const response = await fetch("/api/admin/reject-partner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json();
    setMessage(response.ok ? "Rejected" : body.error || "Fail");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-brand-blue">Pending applications</h2>
      <p className="text-sm text-brand-black/70">Price band dekho, tier choose karo, phir approve.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-sm">
          Pincode
          <select
            value={pincodeFilter}
            onChange={(event) => setPincodeFilter(event.target.value)}
            className="ml-2 rounded-lg border px-2 py-1"
          >
            <option value="">All</option>
            {pincodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Area
          <select
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
            className="ml-2 rounded-lg border px-2 py-1"
          >
            <option value="">All</option>
            {NUKKAD_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message ? <p className="mt-2 text-sm font-medium text-brand-blue">{message}</p> : null}
      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-brand-blue/60">Is filter par koi pending signup nahi.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {filtered.map((shop) => {
            const selectedTier = tierPick[shop.id] ?? "";
            const suggested = shop.suggestion?.suggested_tier;
            return (
              <li key={shop.id} className="rounded-xl border border-brand-blue/10 p-4 text-sm">
                <p className="text-lg font-bold text-brand-black">
                  <ShopNameWithTier name={shop.name} tier={null} />
                </p>
                <p className="text-brand-blue/70">
                  {shop.category} · slug {shop.slug} · {shop.phone}
                </p>
                <p className="mt-1 font-semibold text-brand-black">
                  Price band: ₹{shop.price_min ?? "—"} – ₹{shop.price_max ?? "—"}
                </p>
                {shop.suggestion ? (
                  <p className="text-xs text-brand-blue/80">
                    Suggested tier: {tierLabel(shop.suggestion.suggested_tier)} (actual avg bill ₹
                    {shop.suggestion.avg_bill}
                    {shop.suggestion.source === "price_band" ? ", from price band" : ""})
                  </p>
                ) : null}
                {shop.price_list_preview_url ? (
                  <a
                    href={shop.price_list_preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-brand-blue underline"
                  >
                    Price list preview
                  </a>
                ) : null}
                <p className="mt-1 text-brand-black/80">
                  {shop.area || "—"} · PIN {shop.pincode || "—"}
                </p>
                {shop.address ? <p className="text-xs text-brand-black/60">{shop.address}</p> : null}
                <label className="mt-3 block text-sm font-medium">
                  Tier (required)
                  <select
                    value={selectedTier}
                    onChange={(event) =>
                      setTierPick((prev) => ({ ...prev, [shop.id]: event.target.value as ShopTier | "" }))
                    }
                    className="mt-1 w-full max-w-xs rounded-lg border px-2 py-2"
                  >
                    <option value="">Select tier</option>
                    {APPROVAL_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tierLabel(tier)}
                        {suggested === tier ? " (suggested)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={!selectedTier}
                    onClick={() => approve(shop.id)}
                    className="rounded-full bg-brand-yellow px-4 py-1.5 text-xs font-bold text-brand-black disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectPartner(shop.id)}
                    className="rounded-full border border-brand-blue/30 px-4 py-1.5 text-xs font-semibold text-brand-blue"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

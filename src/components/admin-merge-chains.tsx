"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ShopNameWithTier } from "@/components/tier-badge";
import { tiersCompatible, tierLabel, type ShopTier } from "@/lib/tiers";

type Biz = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  chain_id: string | null;
  tier: ShopTier | null;
  suggestion: { suggested_tier: ShopTier; avg_bill: number; source: string } | null;
};

export function AdminMergeChains({ businesses }: { businesses: Biz[] }) {
  const router = useRouter();
  const [name, setName] = useState("Mukherjee Nagar Pilot");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const eligible = useMemo(() => businesses.filter((b) => !b.chain_id && b.tier), [businesses]);

  const anchorTier = useMemo(() => {
    if (selected.length === 0) return null;
    const first = eligible.find((b) => b.id === selected[0]);
    return first?.tier ?? null;
  }, [selected, eligible]);

  const visible = useMemo(() => {
    if (!anchorTier) return eligible;
    return eligible.filter((b) => tiersCompatible(anchorTier, b.tier));
  }, [eligible, anchorTier]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function merge() {
    setMessage("");
    const response = await fetch("/api/admin/merge-chain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, business_ids: selected }),
    });
    const body = await response.json();
    setMessage(response.ok ? `Chain "${name}" ready — partners notified` : body.error || "Merge fail");
    if (response.ok) {
      setSelected([]);
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-brand-blue">Merge chain</h2>
      <p className="text-sm text-brand-black/70">
        Sirf same ya adjacent tier (E↔M↔P). Economy + Premium ek chain mein nahi.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-3 w-full max-w-md rounded-xl border px-3 py-2"
        placeholder="Chain name"
      />
      <ul className="mt-4 space-y-2">
        {visible.map((biz) => (
          <li key={biz.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
            <input type="checkbox" checked={selected.includes(biz.id)} onChange={() => toggle(biz.id)} />
            <ShopNameWithTier name={biz.name} tier={biz.tier} className="font-medium" />
            <span className="text-xs text-brand-blue/60">{biz.tier ? tierLabel(biz.tier) : ""}</span>
            {biz.suggestion ? (
              <span className="text-xs text-brand-black/50">
                Suggested tier: {tierLabel(biz.suggestion.suggested_tier)} (actual avg bill ₹
                {biz.suggestion.avg_bill})
              </span>
            ) : null}
          </li>
        ))}
        {eligible.length === 0 ? (
          <li className="text-sm text-brand-blue/60">Koi tier-wali active shop nahi.</li>
        ) : null}
      </ul>
      <button
        type="button"
        disabled={selected.length < 2}
        onClick={merge}
        className="mt-4 rounded-full bg-brand-blue px-5 py-2 font-semibold text-white disabled:opacity-50"
      >
        Merge {selected.length} shops
      </button>
      {message ? <p className="mt-2 text-sm font-medium text-brand-blue">{message}</p> : null}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Biz = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  chain_id: string | null;
};

export function AdminMergeChains({ businesses }: { businesses: Biz[] }) {
  const router = useRouter();
  const [name, setName] = useState("Mukherjee Nagar Pilot");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");

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

  const eligible = businesses.filter((b) => !b.chain_id);

  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-brand-blue">Merge chain</h2>
      <p className="text-sm text-brand-black/70">3–4 approved partners select karo — ek referral chain banegi. QR tab unlock hoga.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-3 w-full max-w-md rounded-xl border px-3 py-2"
        placeholder="Chain name"
      />
      <ul className="mt-4 space-y-2">
        {eligible.map((biz) => (
          <li key={biz.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <input type="checkbox" checked={selected.includes(biz.id)} onChange={() => toggle(biz.id)} />
            <span className="font-medium">{biz.name}</span>
            <span className="text-xs text-brand-blue/60">{biz.phone}</span>
          </li>
        ))}
        {eligible.length === 0 ? <li className="text-sm text-brand-blue/60">Sab partners pehle se chain mein hain.</li> : null}
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

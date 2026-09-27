"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  created_at: string;
};

export function AdminPendingPartners({ pending }: { pending: PendingPartner[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function approve(id: string) {
    setMessage("");
    const response = await fetch("/api/admin/approve-partner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json();
    setMessage(response.ok ? `Approved ${body.slug}` : body.error || "Fail");
    router.refresh();
  }

  async function reject(id: string) {
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
      <p className="text-sm text-brand-black/70">Nayi shops — approve karke partner login enable karo.</p>
      {message ? <p className="mt-2 text-sm font-medium text-brand-blue">{message}</p> : null}
      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-brand-blue/60">Koi pending signup nahi.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {pending.map((shop) => (
            <li key={shop.id} className="rounded-xl border border-brand-blue/10 p-4 text-sm">
              <p className="text-lg font-bold text-brand-black">{shop.name}</p>
              <p className="text-brand-blue/70">
                {shop.category} · slug {shop.slug} · {shop.phone}
              </p>
              <dl className="mt-2 grid gap-1 text-brand-black/80 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-brand-blue/50">Owner</dt>
                  <dd>{shop.owner_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-brand-blue/50">Footfall / day</dt>
                  <dd>{shop.daily_footfall ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-brand-blue/50">Peak hours</dt>
                  <dd>{shop.peak_hours || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-brand-blue/50">Customers</dt>
                  <dd>{shop.customer_type || "—"}</dd>
                </div>
              </dl>
              <p className="mt-1 text-xs text-brand-black/50">
                Applied {new Date(shop.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => approve(shop.id)}
                  className="rounded-full bg-brand-yellow px-4 py-1.5 text-xs font-bold text-brand-black"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => reject(shop.id)}
                  className="rounded-full border border-brand-blue/30 px-4 py-1.5 text-xs font-semibold text-brand-blue"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

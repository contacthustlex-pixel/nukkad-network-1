"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Dispute = {
  id: string;
  created_at: string;
  reason: string;
  proof_url: string | null;
  status: string;
  business_name: string;
  customer_name: string;
  gross: number;
  net_payable: number;
};

export function AdminDisputes({ rows }: { rows: Dispute[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function resolve(id: string, outcome: "upheld" | "rejected") {
    setMessage("");
    const response = await fetch("/api/admin/resolve-dispute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, outcome }),
    });
    const body = await response.json();
    setMessage(response.ok ? `Dispute ${outcome}` : body.error || "Fail");
    router.refresh();
  }

  const pending = rows.filter((row) => row.status === "pending");

  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-brand-blue">Complaints</h2>
      <p className="text-sm text-brand-black/70">Customer disputes — 48h review.</p>
      {message ? <p className="mt-2 text-sm font-medium text-brand-blue">{message}</p> : null}
      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-brand-blue/60">Koi pending complaint nahi.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((row) => (
            <li key={row.id} className="rounded-xl border border-brand-blue/10 p-4 text-sm">
              <p className="font-semibold text-brand-black">
                {row.customer_name} · {row.business_name}
              </p>
              <p className="text-brand-blue/70">
                Bill ₹{row.gross} · pay ₹{row.net_payable}
              </p>
              <p className="mt-2 text-brand-black/80">{row.reason}</p>
              {row.proof_url ? (
                <a href={row.proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-brand-blue underline">
                  Proof
                </a>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => resolve(row.id, "upheld")}
                  className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-black"
                >
                  Uphold customer
                </button>
                <button
                  type="button"
                  onClick={() => resolve(row.id, "rejected")}
                  className="rounded-full border border-brand-blue/30 px-3 py-1 text-xs font-semibold text-brand-blue"
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

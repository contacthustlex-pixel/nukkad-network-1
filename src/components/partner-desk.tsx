"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

type Preview = {
  customer_name: string | null;
  discount_pct: number;
  discount_cap: number;
  min_bill: number;
  valid_message?: string;
};

type LedgerRow = {
  id: string;
  customer: string;
  gross: number;
  referrer: number;
  platform: number;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function PartnerDesk({
  ledger,
  netDue,
  weekLabel,
  mapsUrl,
  instagramUrl,
  chainReady,
}: {
  ledger: LedgerRow[];
  netDue: number | null;
  weekLabel: string;
  mapsUrl: string | null;
  instagramUrl: string | null;
  chainReady: boolean;
}) {
  const [gross, setGross] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [maps, setMaps] = useState(mapsUrl ?? "");
  const [insta, setInsta] = useState(instagramUrl ?? "");

  const grossN = Number(gross);

  const calc = useMemo(() => {
    if (!preview || !Number.isFinite(grossN) || grossN <= 0) return null;
    const discount = Math.min(money((grossN * Number(preview.discount_pct)) / 100), Number(preview.discount_cap));
    return {
      discount,
      payable: money(grossN - discount),
      belowMin: grossN < Number(preview.min_bill),
    };
  }, [grossN, preview]);

  async function checkCode(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setToast("");
    setPreview(null);
    if (!Number.isFinite(grossN) || grossN <= 0) {
      setError("Pehle bill amount daalo");
      return;
    }
    if (!code.trim()) {
      setError("Phir code daalo");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/partner/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, gross: grossN }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Code not valid");
      setPreview(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code not valid");
    } finally {
      setLoading(false);
    }
  }

  async function confirmRedeem(event: FormEvent) {
    event.preventDefault();
    if (!preview || !calc || calc.belowMin) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, gross: grossN, is_new: isNew }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Redeem fail");
      setToast(body.partner_message || `Done. Next code: ${body.next_code}`);
      setPreview(null);
      setCode("");
      setGross("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redeem fail");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/partner/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maps_url: maps, instagram_url: insta }),
    });
    const body = await response.json();
    setToast(response.ok ? "Profile save ho gaya" : body.error || "Fail");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {toast ? (
        <p className="lg:col-span-2 rounded-xl bg-brand-yellow px-4 py-3 font-semibold text-brand-black">{toast}</p>
      ) : null}
      <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">Section 1 — Bill pe discount</p>
        <h2 className="mt-1 text-lg font-bold text-brand-black">Payment par code</h2>
        <p className="mt-1 text-sm text-brand-blue/70">Pehle bill, phir code. Valid code par discount dikhega.</p>
        <label className="mt-4 block text-sm font-medium text-brand-black">
          Total bill amount (₹)
          <input
            required
            inputMode="decimal"
            value={gross}
            onChange={(event) => {
              setGross(event.target.value);
              setPreview(null);
              setError("");
            }}
            className="mt-1 w-full rounded-xl border border-brand-blue/20 px-3 py-3 text-lg"
            placeholder="5000"
          />
        </label>
        <form onSubmit={checkCode} className="mt-3 space-y-3">
          <label className="block text-sm font-medium text-brand-black">
            Referral code
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setPreview(null);
              }}
              placeholder="NK-XXXXX"
              className="mt-1 w-full rounded-xl border border-brand-blue/20 px-3 py-3 font-mono uppercase"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-blue px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Check ho raha hai..." : "Code check karo"}
          </button>
        </form>
        {preview && calc && !calc.belowMin ? (
          <div className="mt-4 rounded-xl border-2 border-brand-yellow bg-brand-yellow/20 p-4">
            <p className="font-bold text-brand-black">{preview.valid_message}</p>
            <p className="mt-1 text-sm text-brand-blue">
              Customer: {preview.customer_name || "—"} · discount {preview.discount_pct}%
            </p>
            <form onSubmit={confirmRedeem} className="mt-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isNew} onChange={(event) => setIsNew(event.target.checked)} />
                Naya customer
              </label>
              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full rounded-full bg-brand-black px-4 py-3 font-semibold text-white"
              >
                Confirm — customer ko WhatsApp bhejo
              </button>
            </form>
          </div>
        ) : null}
        {calc?.belowMin ? <p className="mt-2 text-sm text-red-700">Minimum bill ₹{preview?.min_bill}</p> : null}
        {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </section>
      <section className="space-y-4">
        <div className="rounded-2xl bg-brand-blue p-5 text-white">
          <p className="text-sm text-brand-yellow">Settlement · {weekLabel}</p>
          <p className="mt-2 text-2xl font-bold">{netDue == null ? "Abhi settle nahi" : `Net due ₹${netDue}`}</p>
        </div>
        {chainReady ? (
          <div className="space-y-2">
            <a
              href="/api/partner/qr"
              className="block rounded-full bg-brand-yellow px-4 py-3 text-center font-bold text-brand-black"
            >
              QR poster download
            </a>
            <Link
              href="/kit"
              className="block rounded-full border border-brand-blue/20 px-4 py-2 text-center text-sm font-semibold text-brand-blue"
            >
              Table kit guide
            </Link>
          </div>
        ) : (
          <p className="rounded-2xl border border-brand-blue/15 bg-white px-4 py-3 text-sm text-brand-blue/80">
            Customer QR tabhi milega jab admin aapki shop ko doosri partners ke saath chain mein merge kar dega.
          </p>
        )}
        <form onSubmit={saveProfile} className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm space-y-3">
          <h2 className="font-bold text-brand-black">Shop profile</h2>
          <input value={maps} onChange={(event) => setMaps(event.target.value)} placeholder="Maps URL" className="w-full rounded-xl border px-3 py-2" />
          <input value={insta} onChange={(event) => setInsta(event.target.value)} placeholder="Instagram URL" className="w-full rounded-xl border px-3 py-2" />
          <button className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </section>
      <section className="lg:col-span-2 rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">Section 3 — Is hafte</p>
        <h2 className="font-bold text-brand-black">Redemption ledger</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="text-brand-blue/60">
              <th className="py-2">Customer</th>
              <th>Gross</th>
              <th>Referrer</th>
              <th>Platform</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => (
              <tr key={row.id} className="border-t border-brand-blue/10">
                <td className="py-2">{row.customer}</td>
                <td>₹{row.gross}</td>
                <td>₹{row.referrer}</td>
                <td>₹{row.platform}</td>
              </tr>
            ))}
            {ledger.length === 0 ? (
              <tr>
                <td className="py-3 text-brand-blue/60" colSpan={4}>
                  Is hafte koi redeem nahi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

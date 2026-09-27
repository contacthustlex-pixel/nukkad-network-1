"use client";

import { useMemo, useState, type FormEvent } from "react";

type Preview = {
  customer_name: string | null;
  discount_pct: number;
  discount_cap: number;
  min_bill: number;
  referrer_mode: "pct" | "flat";
  referrer_pct: number | null;
  referrer_flat: number | null;
  platform_mode: "pct" | "flat";
  platform_pct: number | null;
  platform_flat: number | null;
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
}: {
  ledger: LedgerRow[];
  netDue: number | null;
  weekLabel: string;
  mapsUrl: string | null;
  instagramUrl: string | null;
}) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [gross, setGross] = useState("");
  const [isNew, setIsNew] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [maps, setMaps] = useState(mapsUrl ?? "");
  const [insta, setInsta] = useState(instagramUrl ?? "");

  const calc = useMemo(() => {
    if (!preview) return null;
    const grossN = Number(gross);
    if (!Number.isFinite(grossN) || grossN <= 0) return null;
    const discount = Math.min(money((grossN * Number(preview.discount_pct)) / 100), Number(preview.discount_cap));
    const referrer =
      preview.referrer_mode === "pct"
        ? money((grossN * Number(preview.referrer_pct)) / 100)
        : Number(preview.referrer_flat);
    const platform =
      preview.platform_mode === "pct"
        ? money((grossN * Number(preview.platform_pct)) / 100)
        : Number(preview.platform_flat);
    return { discount, payable: money(grossN - discount), referrer, platform, belowMin: grossN < Number(preview.min_bill) };
  }, [gross, preview]);

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setToast("");
    setLoading(true);
    try {
      const response = await fetch("/api/partner/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Code invalid");
      setPreview(body);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Code invalid");
    } finally {
      setLoading(false);
    }
  }

  async function confirmRedeem(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, gross: Number(gross), is_new: isNew }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Redeem fail");
      setToast(`Ho gaya. Next code: ${body.next_code}`);
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
    setError("");
    const response = await fetch("/api/partner/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maps_url: maps, instagram_url: insta }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Profile save nahi hua");
    else setToast("Profile save ho gaya");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {toast ? (
        <p className="lg:col-span-2 rounded-xl bg-amber px-4 py-3 font-semibold text-navy">{toast}</p>
      ) : null}
      <section className="rounded-2xl bg-white p-5 shadow">
        <h2 className="text-lg font-semibold">Code verify</h2>
        <form onSubmit={verifyCode} className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="NK-XXXXX"
            className="flex-1 rounded-xl border border-navy/15 px-3 py-3 font-mono uppercase"
          />
          <button className="rounded-full bg-navy px-4 py-3 font-semibold text-white" disabled={loading}>
            Verify
          </button>
        </form>
        {preview ? (
          <form onSubmit={confirmRedeem} className="mt-4 space-y-3">
            <p className="text-navy">
              Customer: <strong>{preview.customer_name || "—"}</strong> · discount {preview.discount_pct}% (cap ₹
              {preview.discount_cap})
            </p>
            <label className="block text-sm">
              Gross bill
              <input
                required
                inputMode="decimal"
                value={gross}
                onChange={(event) => setGross(event.target.value)}
                className="mt-1 w-full rounded-xl border border-navy/15 px-3 py-3"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isNew} onChange={(event) => setIsNew(event.target.checked)} />
              New customer
            </label>
            {calc ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>Discount ₹{calc.discount}</div>
                <div>Payable ₹{calc.payable}</div>
                <div>Referrer ₹{calc.referrer}</div>
                <div>Platform ₹{calc.platform}</div>
              </dl>
            ) : null}
            {calc?.belowMin ? <p className="text-sm text-red-700">Minimum bill ₹{preview.min_bill}</p> : null}
            <button className="rounded-full bg-amber px-4 py-3 font-semibold text-navy" disabled={loading || calc?.belowMin}>
              Confirm
            </button>
          </form>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>
      <section className="space-y-4">
        <div className="rounded-2xl bg-navy p-5 text-white">
          <p className="text-sm text-amber">Settlement · {weekLabel}</p>
          <p className="mt-2 text-2xl font-bold">{netDue == null ? "Abhi settle nahi" : `Net due ₹${netDue}`}</p>
        </div>
        <a href="/api/partner/qr" className="block rounded-full bg-amber px-4 py-3 text-center font-semibold text-navy">
          QR poster download
        </a>
        <form onSubmit={saveProfile} className="rounded-2xl bg-white p-5 shadow space-y-3">
          <h2 className="font-semibold">Profile</h2>
          <input value={maps} onChange={(event) => setMaps(event.target.value)} placeholder="Maps URL" className="w-full rounded-xl border px-3 py-2" />
          <input value={insta} onChange={(event) => setInsta(event.target.value)} placeholder="Instagram URL" className="w-full rounded-xl border px-3 py-2" />
          <button className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      </section>
      <section className="lg:col-span-2 rounded-2xl bg-white p-5 shadow">
        <h2 className="font-semibold">Is hafte ka ledger</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="text-navy/60">
              <th className="py-2">Customer</th>
              <th>Gross</th>
              <th>Referrer</th>
              <th>Platform</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => (
              <tr key={row.id} className="border-t border-navy/10">
                <td className="py-2">{row.customer}</td>
                <td>₹{row.gross}</td>
                <td>₹{row.referrer}</td>
                <td>₹{row.platform}</td>
              </tr>
            ))}
            {ledger.length === 0 ? (
              <tr>
                <td className="py-3 text-navy/60" colSpan={4}>
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

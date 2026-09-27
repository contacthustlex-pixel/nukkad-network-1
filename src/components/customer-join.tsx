"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Issued = {
  code: string;
  expires_at: string;
  customer_name: string | null;
};

export function CustomerJoin({
  business,
}: {
  business: { id: string; name: string; category: string };
}) {
  const [step, setStep] = useState<"form" | "otp" | "done">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "OTP nahi gaya");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP nahi gaya");
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, name, business_id: business.id, otp }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Code nahi bana");
      setIssued(body);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code nahi bana");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done" && issued) {
    const expiry = new Date(issued.expires_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <section className="rounded-3xl bg-white p-6 text-center shadow-lg">
        <p className="text-sm text-navy/70">Aapka code</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-widest text-navy">{issued.code}</p>
        <p className="mt-3 text-sm text-navy/80">7 din tak valid · {expiry}</p>
        <p className="mt-4 text-base font-medium text-navy">Agle shop par yeh code dikhao, discount lo.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/shops?c=${issued.code}`}
            className="rounded-full bg-brand-yellow px-4 py-3 font-semibold text-brand-black"
          >
            Option 1 — Discount shops
          </Link>
          <Link href="/about" className="rounded-full border border-brand-blue/20 px-4 py-3 font-semibold text-brand-blue">
            Option 2 — About Nukkad + network
          </Link>
          <Link href={`/my/${phone}`} className="text-sm font-medium text-navy/70 underline">
            Mera code dekho
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-lg">
      <p className="text-sm text-navy/70">{business.category}</p>
      <h1 className="mt-1 text-2xl font-bold text-navy">{business.name}</h1>
      <p className="mt-2 text-sm text-brand-blue/80">
        Naam aur phone daalo. Yeh detail <strong>{business.name}</strong> ke partner dashboard aur Nukkad Admin par dikhegi.
        Code WhatsApp par aayega.
      </p>
      {step === "form" ? (
        <form onSubmit={send} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-navy">
            Naam
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-navy/15 px-3 py-3 outline-none focus:border-amber"
            />
          </label>
          <label className="block text-sm font-medium text-navy">
            Phone
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
              className="mt-1 w-full rounded-xl border border-navy/15 px-3 py-3 outline-none focus:border-amber"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            disabled={loading}
            className="w-full rounded-full bg-navy px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Bhej rahe hain..." : "OTP bhejo"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <p className="text-sm text-navy/80">{phone} par OTP daalo. Demo code 1234.</p>
          <label className="block text-sm font-medium text-navy">
            OTP
            <input
              required
              inputMode="numeric"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-1 w-full rounded-xl border border-navy/15 px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-amber"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            disabled={loading}
            className="w-full rounded-full bg-amber px-4 py-3 font-semibold text-navy disabled:opacity-60"
          >
            {loading ? "Check ho raha hai..." : "Code lo"}
          </button>
        </form>
      )}
    </section>
  );
}

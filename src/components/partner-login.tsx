"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function PartnerLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) setError(body.error || "OTP nahi gaya");
    else setSent(true);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/partner/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) setError(body.error || "Login fail");
    else router.refresh();
  }

  return (
    <form onSubmit={sent ? login : send} className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 shadow space-y-3">
      <h1 className="text-2xl font-bold">Partner login</h1>
      <p className="text-sm text-navy/70">Shop wala phone. Demo OTP 1234.</p>
      <input
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="Phone"
        className="w-full rounded-xl border px-3 py-3"
      />
      {sent ? (
        <input
          required
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="OTP"
          className="w-full rounded-xl border px-3 py-3 text-center font-mono text-2xl tracking-[0.3em]"
        />
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="w-full rounded-full bg-navy py-3 font-semibold text-white">
        {loading ? "Ruko..." : sent ? "Login" : "OTP bhejo"}
      </button>
    </form>
  );
}

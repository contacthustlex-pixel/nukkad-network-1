"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "OTP nahi gaya");
    else setSent(true);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Login fail");
    else router.refresh();
  }

  return (
    <form onSubmit={sent ? login : send} className="mx-auto mt-8 max-w-md space-y-3 rounded-2xl bg-white p-6 shadow">
      <h1 className="text-2xl font-bold">Admin</h1>
      <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Admin phone" className="w-full rounded-xl border px-3 py-3" />
      {sent ? <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="OTP" className="w-full rounded-xl border px-3 py-3" /> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="w-full rounded-full bg-navy py-3 font-semibold text-white">{sent ? "Login" : "OTP bhejo"}</button>
    </form>
  );
}

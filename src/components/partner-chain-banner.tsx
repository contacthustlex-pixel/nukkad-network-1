"use client";

import { useState } from "react";

export function PartnerChainBanner({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  async function dismiss() {
    setBusy(true);
    try {
      await fetch("/api/partner/ack-chain", { method: "POST" });
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-brand-yellow bg-brand-yellow/25 px-5 py-4">
      <p className="font-bold text-brand-black">Chain update</p>
      <p className="mt-1 text-brand-blue">{message}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void dismiss()}
        className="mt-3 rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "..." : "Samajh gaya"}
      </button>
    </section>
  );
}

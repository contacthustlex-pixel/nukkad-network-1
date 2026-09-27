"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminFollowupSettings({ followupAuto }: { followupAuto: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(followupAuto);
  const [message, setMessage] = useState("");

  async function save(next: boolean) {
    setMessage("");
    const response = await fetch("/api/admin/settings/followup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "Save fail");
      return;
    }
    setEnabled(next);
    setMessage("Saved");
    router.refresh();
  }

  async function runCron() {
    setMessage("");
    const response = await fetch("/api/cron/followup");
    const body = await response.json();
    setMessage(response.ok ? `Follow-up sent: ${body.sent}` : body.error || "Cron fail");
  }

  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-brand-blue">Follow-up WhatsApp</h2>
      <p className="text-sm text-brand-black/70">
        Pending scan customers ko visited / busy prompt. Auto cron sirf jab toggle ON ho.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={(event) => void save(event.target.checked)} />
        Automatic daily follow-up
      </label>
      <button
        type="button"
        onClick={() => void runCron()}
        className="mt-3 rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white"
      >
        Run follow-up now
      </button>
      {message ? <p className="mt-2 text-sm text-brand-blue">{message}</p> : null}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ComplaintForm({ redemptionId }: { redemptionId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/complaint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          redemption_id: redemptionId,
          reason,
          proof_url: proofUrl || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Complaint fail");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Complaint fail");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="mt-4 rounded-xl bg-brand-yellow/30 px-4 py-3 text-sm font-semibold text-brand-black">
        Complaint register ho gayi. 48 ghante mein verify karenge.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm font-medium text-brand-black">
        Kya galat tha?
        <textarea
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-brand-blue/20 px-3 py-2"
          placeholder="Bill amount galat thi / discount nahi mila..."
        />
      </label>
      <label className="block text-sm font-medium text-brand-black">
        Proof link (optional)
        <input
          value={proofUrl}
          onChange={(event) => setProofUrl(event.target.value)}
          placeholder="Receipt photo link (Google Drive / etc.)"
          className="mt-1 w-full rounded-xl border border-brand-blue/20 px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-brand-blue py-3 font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Bhej rahe hain..." : "Complaint bhejo"}
      </button>
    </form>
  );
}

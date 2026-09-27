"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = {
  id: string;
  business: string;
  week_start: string;
  week_end: string;
  dues: number;
  credits: number;
  net_due: number;
  status: string;
};

export function AdminSettlements({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [upi, setUpi] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function runCron(path: string) {
    setMessage("");
    const response = await fetch(path);
    const body = await response.json();
    setMessage(response.ok ? `${path} ok` : body.error || "Cron fail");
    router.refresh();
  }

  async function markPaid(id: string) {
    setMessage("");
    const response = await fetch("/api/admin/paid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, upi_ref: upi[id] || "" }),
    });
    const body = await response.json();
    setMessage(response.ok ? "Paid, shop active" : body.error || "Fail");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button onClick={() => runCron("/api/cron/settle")} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">
          Run settle
        </button>
        <button onClick={() => runCron("/api/cron/block")} className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-navy">
          Run block
        </button>
      </div>
      {message ? <p className="text-sm font-medium">{message}</p> : null}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-navy/60">
            <th className="py-2">Business</th>
            <th>Week</th>
            <th>Dues</th>
            <th>Credits</th>
            <th>Net</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-navy/10">
              <td className="py-2">{row.business}</td>
              <td>
                {row.week_start} – {row.week_end}
              </td>
              <td>₹{row.dues}</td>
              <td>₹{row.credits}</td>
              <td>₹{row.net_due}</td>
              <td>{row.status}</td>
              <td>
                {row.status === "unpaid" ? (
                  <span className="flex gap-2">
                    <input
                      value={upi[row.id] ?? ""}
                      onChange={(event) => setUpi({ ...upi, [row.id]: event.target.value })}
                      placeholder="UPI ref"
                      className="w-28 rounded border px-2 py-1"
                    />
                    <button onClick={() => markPaid(row.id)} className="rounded-full bg-navy px-3 py-1 text-white">
                      Mark Paid
                    </button>
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

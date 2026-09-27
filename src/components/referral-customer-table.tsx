"use client";

import type { ReferralCustomerRow } from "@/lib/referrals";
import { FOLLOWUP_PROMPT, whatsappChatLink } from "@/lib/site-url";

export function ReferralCustomerTable({
  title,
  rows,
  showSource,
  onBroadcastPending,
}: {
  title: string;
  rows: ReferralCustomerRow[];
  showSource?: boolean;
  onBroadcastPending?: () => void;
}) {
  const pending = rows.filter((row) => !row.redeemed);

  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-black">{title}</h2>
          <p className="text-sm text-brand-blue/70">
            QR scan par naam + number yahan dikhte hain. Code use hone par status update hota hai.
          </p>
        </div>
        {onBroadcastPending && pending.length > 0 ? (
          <button
            type="button"
            onClick={onBroadcastPending}
            className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-black"
          >
            WhatsApp — sab pending ({pending.length})
          </button>
        ) : null}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-brand-blue/60">
              <th className="py-2 pr-2">Customer</th>
              <th className="py-2 pr-2">Phone</th>
              {showSource ? <th className="py-2 pr-2">Referrer shop</th> : null}
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Active code</th>
              <th className="py-2">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-brand-blue/10">
                <td className="py-2 pr-2 font-medium text-brand-black">{row.name}</td>
                <td className="py-2 pr-2">{row.phone}</td>
                {showSource ? <td className="py-2 pr-2">{row.sourceBusinessName}</td> : null}
                <td className="py-2 pr-2">
                  {row.redeemed ? (
                    <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-brand-blue">Code use ho gaya</span>
                  ) : (
                    <span className="rounded-full bg-brand-yellow/40 px-2 py-0.5 text-brand-black">Abhi visit nahi</span>
                  )}
                </td>
                <td className="py-2 pr-2 font-mono text-xs">{row.activeCode || "—"}</td>
                <td className="py-2">
                  {!row.redeemed ? (
                    <a
                      href={whatsappChatLink(row.phone, FOLLOWUP_PROMPT)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand-blue underline"
                    >
                      Visit hua?
                    </a>
                  ) : row.lastRedemptionId ? (
                    <a href={`/complaint/${row.lastRedemptionId}`} className="text-brand-blue/70 underline">
                      Complaint
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showSource ? 6 : 5} className="py-6 text-brand-blue/60">
                  Abhi koi customer scan nahi kiya.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

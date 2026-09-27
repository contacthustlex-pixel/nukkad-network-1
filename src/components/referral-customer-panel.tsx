"use client";

import { useState } from "react";
import type { ReferralCustomerRow } from "@/lib/referrals";
import { ReferralCustomerTable } from "@/components/referral-customer-table";

export function ReferralCustomerPanel({
  title,
  rows,
  showSource,
  sourceBusinessId,
}: {
  title: string;
  rows: ReferralCustomerRow[];
  showSource?: boolean;
  sourceBusinessId?: string;
}) {
  const [message, setMessage] = useState("");

  async function broadcastPending() {
    setMessage("");
    const response = await fetch("/api/followup/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_business_id: sourceBusinessId }),
    });
    const body = await response.json();
    setMessage(response.ok ? `WhatsApp stub: ${body.sent} customers` : body.error || "Fail");
  }

  return (
    <div className="space-y-2">
      <ReferralCustomerTable
        title={title}
        rows={rows}
        showSource={showSource}
        onBroadcastPending={broadcastPending}
      />
      {message ? <p className="text-sm font-medium text-brand-blue">{message}</p> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type App = {
  id: string;
  shop_name: string;
  phone: string;
  owner_name: string;
  monthly_revenue: number;
  avg_order_value: number;
  daily_footfall: number;
  status: string;
  slug: string;
};

export function AdminPartners({ applications }: { applications: App[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function approve(id: string) {
    setMessage("");
    const response = await fetch("/api/admin/approve-partner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json();
    setMessage(response.ok ? `Approved ${body.slug}` : body.error || "Fail");
    router.refresh();
  }

  const pending = applications.filter((a) => a.status === "pending");

  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-brand-blue">Partners</h2>
      <p className="text-sm text-brand-black/70">Signup applications — approve, phir chain merge karo.</p>
      {message ? <p className="mt-2 text-sm font-medium text-brand-blue">{message}</p> : null}
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="text-brand-blue/60">
            <th className="py-2">Shop</th>
            <th>Owner</th>
            <th>Phone</th>
            <th>Revenue</th>
            <th>AOV</th>
            <th>Footfall</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id} className="border-t border-brand-blue/10">
              <td className="py-2 font-medium">{app.shop_name}</td>
              <td>{app.owner_name}</td>
              <td>{app.phone}</td>
              <td>₹{app.monthly_revenue}</td>
              <td>₹{app.avg_order_value}</td>
              <td>{app.daily_footfall}</td>
              <td>{app.status}</td>
              <td>
                {app.status === "pending" ? (
                  <button type="button" onClick={() => approve(app.id)} className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold">
                    Approve
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {applications.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-4 text-brand-blue/60">
                Koi signup nahi.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {pending.length > 0 ? (
        <p className="mt-3 text-xs text-brand-black/60">{pending.length} pending approval</p>
      ) : null}
    </section>
  );
}

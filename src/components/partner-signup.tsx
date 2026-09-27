"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const categories = ["Cafe", "Salon", "Laundry", "Gym", "Xerox"];

export function PartnerSignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/partner/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shop_name: form.get("shop_name"),
        slug: form.get("slug"),
        phone: form.get("phone"),
        owner_name: form.get("owner_name"),
        category: form.get("category"),
        monthly_revenue: form.get("monthly_revenue"),
        avg_order_value: form.get("avg_order_value"),
        daily_footfall: form.get("daily_footfall"),
      }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error || "Signup fail");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <section className="mx-auto mt-8 max-w-lg rounded-2xl border border-brand-blue/15 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-blue">Application bhej di</h1>
        <p className="mt-3 text-brand-black/80">
          Nukkad team review karegi. Chain merge ke baad aapko WhatsApp par bataya jayega — phir partner login se QR
          download karna.
        </p>
        <button
          type="button"
          onClick={() => router.push("/partner")}
          className="mt-4 rounded-full bg-brand-yellow px-4 py-2 font-bold text-brand-black"
        >
          Partner login
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-lg space-y-3 rounded-2xl border border-brand-blue/15 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-brand-blue">Partner signup</h1>
      <p className="text-sm text-brand-black/70">Shop details — admin approve karke chain mein merge karega.</p>
      <input name="shop_name" required placeholder="Shop name" className="w-full rounded-xl border px-3 py-2" />
      <input name="slug" required placeholder="URL slug (e.g. my-salon)" className="w-full rounded-xl border px-3 py-2" />
      <input name="owner_name" required placeholder="Owner name" className="w-full rounded-xl border px-3 py-2" />
      <input name="phone" required pattern="[0-9]{10}" placeholder="10 digit phone" className="w-full rounded-xl border px-3 py-2" />
      <select name="category" required className="w-full rounded-xl border px-3 py-2">
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="monthly_revenue" required type="number" min="0" step="1" placeholder="Monthly revenue (₹)" className="w-full rounded-xl border px-3 py-2" />
      <input name="avg_order_value" required type="number" min="0" step="1" placeholder="Average order value (₹)" className="w-full rounded-xl border px-3 py-2" />
      <input name="daily_footfall" required type="number" min="0" step="1" placeholder="Daily footfall (count)" className="w-full rounded-xl border px-3 py-2" />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="w-full rounded-full bg-brand-blue py-3 font-semibold text-white">
        {loading ? "Bhej rahe hain..." : "Apply"}
      </button>
    </form>
  );
}

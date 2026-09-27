"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { NUKKAD_AREAS } from "@/lib/locations";

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
        daily_footfall: form.get("daily_footfall"),
        peak_hours: form.get("peak_hours"),
        customer_type: form.get("customer_type"),
        pincode: form.get("pincode"),
        area: form.get("area"),
        address: form.get("address"),
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
          Nukkad team review karegi. Approve hone ke baad isi phone se partner login karo — chain merge ke baad QR
          milega.
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
    <form
      onSubmit={submit}
      className="mx-auto mt-8 max-w-lg space-y-3 rounded-2xl border border-brand-blue/15 bg-white p-6 shadow-sm"
    >
      <h1 className="text-2xl font-bold text-brand-blue">Partner signup</h1>
      <p className="text-sm text-brand-black/70">Shop profile — admin approve karke chain mein merge karega.</p>
      <input name="shop_name" required placeholder="Shop name" className="w-full rounded-xl border px-3 py-2" />
      <input name="slug" required placeholder="URL slug (e.g. my-salon)" className="w-full rounded-xl border px-3 py-2" />
      <input name="owner_name" required placeholder="Owner name" className="w-full rounded-xl border px-3 py-2" />
      <input
        name="phone"
        required
        pattern="[0-9]{10}"
        placeholder="10 digit phone"
        className="w-full rounded-xl border px-3 py-2"
      />
      <select name="category" required className="w-full rounded-xl border px-3 py-2">
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        name="pincode"
        required
        pattern="[0-9]{6}"
        maxLength={6}
        inputMode="numeric"
        placeholder="Pincode (6 digit)"
        className="w-full rounded-xl border px-3 py-2"
      />
      <select name="area" required className="w-full rounded-xl border px-3 py-2">
        <option value="">Area select karo</option>
        {NUKKAD_AREAS.map((area) => (
          <option key={area} value={area}>
            {area}
          </option>
        ))}
      </select>
      <textarea
        name="address"
        required
        rows={2}
        placeholder="Full shop address"
        className="w-full rounded-xl border px-3 py-2"
      />
      <input
        name="daily_footfall"
        required
        type="number"
        min="0"
        step="1"
        placeholder="Daily footfall (count)"
        className="w-full rounded-xl border px-3 py-2"
      />
      <input
        name="peak_hours"
        required
        placeholder='Peak hours (e.g. "6pm-11pm")'
        className="w-full rounded-xl border px-3 py-2"
      />
      <select name="customer_type" required className="w-full rounded-xl border px-3 py-2">
        <option value="">Customer type</option>
        <option value="students">Students</option>
        <option value="families">Families</option>
        <option value="mixed">Mixed</option>
      </select>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="w-full rounded-full bg-brand-blue py-3 font-semibold text-white">
        {loading ? "Bhej rahe hain..." : "Apply"}
      </button>
    </form>
  );
}

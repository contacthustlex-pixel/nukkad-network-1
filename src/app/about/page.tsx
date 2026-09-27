import Link from "next/link";
import { Logo } from "@/components/logo";
import { createServiceClient } from "@/lib/supabase-server";
import { categoryIcon } from "@/lib/categories";

export default async function AboutPage() {
  const supabase = createServiceClient();
  const [{ data: businesses }, { data: categories }] = await Promise.all([
    supabase.from("businesses").select("*").eq("status", "active").limit(50),
    supabase.from("categories").select("id,name").limit(20),
  ]);
  const catNames = new Map((categories ?? []).map((row) => [row.id, row.name as string]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Logo />
      <h1 className="mt-6 text-3xl font-bold text-brand-blue">Nukkad Network kaise kaam karta hai</h1>
      <p className="mt-3 text-brand-black/80">
        Pehle aap ek shop par QR scan karte ho (jaise restaurant). Wahan se aapko code milta hai. Phir aap salon, gym,
        dance class par 10% discount le sakte ho — jahan pehle use nahi kiya. Har redeem ke baad naya code, nayi shops.
      </p>
      <div className="mt-8 aspect-video rounded-2xl bg-brand-black/90 flex items-center justify-center text-brand-yellow font-semibold">
        Video placeholder — app demo yahan embed hoga
      </div>
      <ol className="mt-8 space-y-3 text-sm text-brand-black">
        <li className="rounded-xl bg-brand-yellow/30 p-3">1. QR scan → naam + phone → WhatsApp par code</li>
        <li className="rounded-xl bg-brand-white border p-3">2. Referral shop par bill + code → discount confirm</li>
        <li className="rounded-xl bg-brand-blue/10 p-3">3. Naya code → agli shops (restaurant wapas tab jab pehle use na kiya ho)</li>
      </ol>
      <h2 className="mt-10 text-xl font-bold text-brand-blue">Network list</h2>
      <ul className="mt-4 space-y-3">
        {(businesses ?? []).map((shop) => {
          const category = catNames.get(shop.category_id) ?? "Shop";
          return (
            <li key={shop.id} className="rounded-xl border border-brand-blue/10 bg-white p-4">
              <p className="font-bold text-brand-black">
                {categoryIcon(category)} {shop.name}
              </p>
              <p className="text-sm text-brand-blue/70">{category}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
                {shop.maps_url ? (
                  <a className="text-brand-blue underline" href={shop.maps_url} target="_blank" rel="noreferrer">
                    Location
                  </a>
                ) : null}
                {shop.instagram_url ? (
                  <a className="text-brand-blue underline" href={shop.instagram_url} target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                ) : null}
                <Link className="text-brand-blue underline" href={`/r/${shop.slug}`}>
                  QR / join
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-10 text-center text-sm text-brand-black/60">A Nukkad Digital venture</p>
    </main>
  );
}

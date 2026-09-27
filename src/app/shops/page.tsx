import Link from "next/link";
import { Logo } from "@/components/logo";
import { categoryIcon } from "@/lib/categories";
import { createServiceClient } from "@/lib/supabase-server";

type Business = {
  id: string;
  name: string;
  slug: string;
  status: string;
  category_id: string;
  chain_id: string | null;
  maps_url: string | null;
  instagram_url: string | null;
};

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const supabase = createServiceClient();
  if (!c) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <Logo />
        <p className="mt-6 text-navy">Pehle apna code lo, phir linked shops khulenge.</p>
      </main>
    );
  }

  const { data: codes } = await supabase.from("referral_codes").select("*").eq("code", c).limit(1);
  const issued = codes?.[0];
  if (!issued) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <Logo />
        <p className="mt-6 text-navy">Yeh code nahi mila.</p>
      </main>
    );
  }

  const [{ data: businesses }, { data: categories }, { data: redemptions }, { data: customers }] = await Promise.all([
    supabase.from("businesses").select("*").eq("status", "active").limit(200),
    supabase.from("categories").select("id,name").limit(20),
    supabase.from("redemptions").select("business_id").eq("customer_id", issued.customer_id).limit(200),
    supabase.from("customers").select("phone").eq("id", issued.customer_id).limit(1),
  ]);

  const sourceShop = ((businesses ?? []) as Business[]).find((shop) => shop.id === issued.source_business_id);
  const chainId = sourceShop?.chain_id ?? null;

  const names = new Map((categories ?? []).map((row) => [row.id, row.name as string]));
  const used = new Set((redemptions ?? []).map((row) => row.business_id as string));
  const eligible = ((businesses ?? []) as Business[]).filter(
    (shop) =>
      shop.id !== issued.source_business_id &&
      !used.has(shop.id) &&
      (chainId == null || shop.chain_id === chainId),
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <Logo />
      <h1 className="text-2xl font-bold text-navy">Linked shops</h1>
      <p className="mt-2 text-sm text-brand-black/80">In shops par apna code dikhao. Chain merge ke baad sirf usi chain ki shops dikhengi.</p>
      {eligible.length === 0 ? <p className="text-navy">Abhi koi shop available nahi.</p> : null}
      <ul className="space-y-3">
        {eligible.map((shop) => {
          const category = names.get(shop.category_id) ?? "Shop";
          return (
            <li key={shop.id} className="rounded-2xl bg-white p-4 shadow">
              <p className="text-lg font-semibold text-navy">
                <span className="mr-2" aria-hidden>{categoryIcon(category)}</span>
                {shop.name}
              </p>
              <p className="text-sm text-navy/70">{category}</p>
              <div className="mt-3 flex gap-3 text-sm font-semibold">
                {shop.maps_url ? (
                  <a className="text-navy underline" href={shop.maps_url} target="_blank" rel="noreferrer">
                    Maps
                  </a>
                ) : (
                  <span className="text-navy/40">Maps jald</span>
                )}
                {shop.instagram_url ? (
                  <a className="text-navy underline" href={shop.instagram_url} target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                ) : (
                  <span className="text-navy/40">Insta jald</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Link href={`/my/${customers?.[0]?.phone ?? ""}`} className="text-sm font-medium text-navy underline">
        Mera code
      </Link>
    </main>
  );
}

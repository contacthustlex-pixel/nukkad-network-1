import { cookies } from "next/headers";
import { Logo } from "@/components/logo";
import { PartnerChainBanner } from "@/components/partner-chain-banner";
import { PartnerDesk } from "@/components/partner-desk";
import { PartnerLogin } from "@/components/partner-login";
import { ReferralCustomerPanel } from "@/components/referral-customer-panel";
import { ShopNameWithTier } from "@/components/tier-badge";
import { loadReferralCustomerRows } from "@/lib/referrals";
import { readPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";
import { currentWeekBounds } from "@/lib/week";
import { parseTier } from "@/lib/tiers";

export default async function PartnerPage() {
  const jar = await cookies();
  const businessId = readPartner(jar.get("nk_partner")?.value);
  if (!businessId) {
    return (
      <main className="min-h-full px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <Logo />
          <PartnerLogin />
        </div>
      </main>
    );
  }

  const supabase = createServiceClient();
  const { data: shops } = await supabase.from("businesses").select("*").eq("id", businessId).limit(1);
  const business = shops?.[0];
  if (!business) {
    return <main className="p-8 text-brand-blue">Session ki shop nahi mili. Dubara login karo.</main>;
  }

  const { data: notices } = await supabase
    .from("chain_notifications")
    .select("message")
    .eq("business_id", businessId)
    .eq("seen", false)
    .order("created_at", { ascending: false })
    .limit(1);

  const chainReady = Boolean(business.chain_id);
  const chainBanner = notices?.[0]?.message as string | undefined;
  const shopTier = parseTier(business.tier as string | null);

  if (business.status === "blocked") {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col gap-4 px-4 py-10">
        <Logo />
        <section className="rounded-3xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">
            <ShopNameWithTier name={business.name as string} tier={shopTier} />
          </h1>
          <p className="mt-3 text-lg">Payment pending hai, isliye shop block hai.</p>
          <p className="mt-4 rounded-2xl bg-brand-yellow px-4 py-4 text-center text-xl font-bold text-brand-black">
            UPI nukkad@upi
          </p>
          <p className="mt-3 text-sm text-brand-blue/70">Admin confirm karega, phir shop wapas active hogi.</p>
        </section>
      </main>
    );
  }

  const week = currentWeekBounds();
  const referralRows = await loadReferralCustomerRows(supabase, { sourceBusinessId: businessId });
  const [{ data: redemptions }, { data: ledger }, { data: customers }, { data: settlements }] = await Promise.all([
    supabase.from("redemptions").select("*").eq("business_id", businessId).limit(200),
    supabase.from("commission_ledger").select("*").limit(500),
    supabase.from("customers").select("id,name").limit(500),
    supabase.from("settlements").select("*").eq("business_id", businessId).order("week_start", { ascending: false }).limit(1),
  ]);

  const names = new Map((customers ?? []).map((row) => [row.id, row.name as string]));
  const weekRows = (redemptions ?? []).filter(
    (row) => row.created_at >= week.start && row.created_at < week.end,
  );
  const lines = weekRows.map((row) => {
    const entries = (ledger ?? []).filter((item) => item.redemption_id === row.id);
    return {
      id: row.id as string,
      customer: names.get(row.customer_id) || "Customer",
      gross: Number(row.gross_bill),
      referrer: Number(entries.find((item) => item.earner_type === "business")?.amount ?? 0),
      platform: Number(entries.find((item) => item.earner_type === "platform")?.amount ?? 0),
    };
  });

  return (
    <main className="mx-auto min-h-full max-w-5xl space-y-8 px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Logo />
          <h1 className="mt-3 text-3xl font-bold text-brand-blue">
            <ShopNameWithTier name={business.name as string} tier={shopTier} />
          </h1>
          <p className="text-sm text-brand-black/60">Partner dashboard</p>
          {business.area || business.pincode ? (
            <p className="mt-1 text-sm text-brand-blue/80">
              {[business.area, business.pincode ? `PIN ${business.pincode}` : null].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {business.address ? <p className="text-xs text-brand-black/50">{business.address}</p> : null}
        </div>
        <p className="text-sm uppercase tracking-wide text-brand-blue/60">{business.status}</p>
      </div>
      {chainBanner ? <PartnerChainBanner message={chainBanner} /> : null}
      <ReferralCustomerPanel
        title="Section 2 — Aapke QR se scan kiye customers"
        rows={referralRows}
        sourceBusinessId={businessId}
      />
      <PartnerDesk
        ledger={lines}
        netDue={settlements?.[0] ? Number(settlements[0].net_due) : null}
        weekLabel={week.label}
        mapsUrl={business.maps_url}
        instagramUrl={business.instagram_url}
        chainReady={chainReady}
      />
    </main>
  );
}

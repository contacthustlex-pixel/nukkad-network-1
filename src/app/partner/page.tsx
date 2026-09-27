import { cookies } from "next/headers";
import { Logo } from "@/components/logo";
import { PartnerDesk } from "@/components/partner-desk";
import { PartnerLogin } from "@/components/partner-login";
import { readPartner } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";
import { currentWeekBounds } from "@/lib/week";

export default async function PartnerPage() {
  const jar = await cookies();
  const businessId = readPartner(jar.get("nk_partner")?.value);
  if (!businessId) {
    return (
      <main className="min-h-full bg-background px-4 py-8">
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
    return <main className="p-8 text-navy">Session ki shop nahi mili. Dubara login karo.</main>;
  }

  if (business.status === "blocked") {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col gap-4 px-4 py-10">
        <Logo />
        <section className="rounded-3xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="mt-3 text-lg">Payment pending hai, isliye shop block hai.</p>
          <p className="mt-4 rounded-2xl bg-amber px-4 py-4 text-center text-xl font-bold">UPI nukkad@upi</p>
          <p className="mt-3 text-sm text-navy/70">Admin confirm karega, phir shop wapas active hogi.</p>
        </section>
      </main>
    );
  }

  const week = currentWeekBounds();
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
    <main className="mx-auto min-h-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Logo />
          <h1 className="mt-3 text-3xl font-bold">{business.name}</h1>
        </div>
        <p className="text-sm uppercase tracking-wide text-navy/60">{business.status}</p>
      </div>
      <PartnerDesk
        ledger={lines}
        netDue={settlements?.[0] ? Number(settlements[0].net_due) : null}
        weekLabel={week.label}
        mapsUrl={business.maps_url}
        instagramUrl={business.instagram_url}
      />
    </main>
  );
}

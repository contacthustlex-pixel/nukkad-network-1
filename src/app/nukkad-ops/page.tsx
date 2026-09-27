import { cookies } from "next/headers";
import { AdminLogin } from "@/components/admin-login";
import { AdminMergeChains } from "@/components/admin-merge-chains";
import { AdminPartners } from "@/components/admin-partners";
import { AdminSettlements } from "@/components/admin-settlements";
import { Logo } from "@/components/logo";
import { ReferralCustomerPanel } from "@/components/referral-customer-panel";
import { loadReferralCustomerRows } from "@/lib/referrals";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export default async function OpsAdminPage() {
  const jar = await cookies();
  if (!readAdmin(jar.get("nk_admin")?.value)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Logo />
        <AdminLogin />
      </main>
    );
  }

  const supabase = createServiceClient();
  const [customerRows, { data: settlements }, { data: businesses }, { data: applications }] = await Promise.all([
    loadReferralCustomerRows(supabase),
    supabase.from("settlements").select("*").order("week_start", { ascending: false }).limit(100),
    supabase.from("businesses").select("id,name,slug,phone,chain_id").limit(200),
    supabase.from("partner_applications").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const names = new Map((businesses ?? []).map((row) => [row.id, row.name as string]));
  const pending = customerRows.filter((row) => !row.redeemed).length;
  const redeemed = customerRows.filter((row) => row.redeemed).length;

  const rows = (settlements ?? []).map((row) => ({
    id: row.id as string,
    business: names.get(row.business_id) || "Shop",
    week_start: String(row.week_start),
    week_end: String(row.week_end),
    dues: Number(row.dues),
    credits: Number(row.credits),
    net_due: Number(row.net_due),
    status: row.status as string,
  }));

  const apps = (applications ?? []).map((row) => ({
    id: row.id as string,
    shop_name: row.shop_name as string,
    phone: row.phone as string,
    owner_name: row.owner_name as string,
    monthly_revenue: Number(row.monthly_revenue),
    avg_order_value: Number(row.avg_order_value),
    daily_footfall: Number(row.daily_footfall),
    status: row.status as string,
    slug: row.slug as string,
  }));

  const bizList = (businesses ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    phone: row.phone as string,
    chain_id: (row.chain_id as string | null) ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <Logo />
      <h1 className="text-3xl font-bold text-brand-blue">Nukkad Network Admin</h1>
      <p className="text-sm text-brand-black/60">Yeh URL public home par nahi dikhta.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-brand-blue p-4 text-white">
          <p className="text-sm text-brand-yellow">Customers (scan)</p>
          <p className="text-3xl font-bold">{customerRows.length}</p>
        </div>
        <div className="rounded-2xl bg-brand-yellow p-4 text-brand-black">
          <p className="text-sm font-semibold">Visit pending</p>
          <p className="text-3xl font-bold">{pending}</p>
        </div>
        <div className="rounded-2xl border border-brand-blue/20 bg-white p-4">
          <p className="text-sm text-brand-blue/70">Partners (shops)</p>
          <p className="text-3xl font-bold text-brand-black">{bizList.length}</p>
        </div>
      </div>
      <AdminPartners applications={apps} />
      <AdminMergeChains businesses={bizList} />
      <ReferralCustomerPanel title="Customers — scan & redeem" rows={customerRows} showSource />
      <section>
        <h2 className="mb-4 text-2xl font-bold text-brand-blue">Settlements</h2>
        <AdminSettlements rows={rows} />
      </section>
    </main>
  );
}

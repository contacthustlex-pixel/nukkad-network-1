import { cookies } from "next/headers";
import { AdminDisputes } from "@/components/admin-disputes";
import { AdminFollowupSettings } from "@/components/admin-followup-settings";
import { AdminInsights } from "@/components/admin-insights";
import { AdminLogin } from "@/components/admin-login";
import { AdminMergeChains } from "@/components/admin-merge-chains";
import { AdminPendingPartners } from "@/components/admin-pending-partners";
import { AdminSettlements } from "@/components/admin-settlements";
import { Logo } from "@/components/logo";
import { ReferralCustomerPanel } from "@/components/referral-customer-panel";
import { loadReferralCustomerRows } from "@/lib/referrals";
import { loadAdminInsightSeries } from "@/lib/admin-insights-data";
import { getFollowupAuto } from "@/lib/settings";
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
  const [customerRows, { data: settlements }, { data: businesses }, { data: categories }, { data: disputes }, { data: allRedemptions }, { data: allCustomers }, insights, followupAuto] =
    await Promise.all([
    loadReferralCustomerRows(supabase),
    supabase.from("settlements").select("*").order("week_start", { ascending: false }).limit(100),
    supabase
      .from("businesses")
      .select(
        "id,name,slug,phone,chain_id,status,owner_name,daily_footfall,peak_hours,customer_type,category_id,created_at,pincode,area,address,latitude,longitude",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("categories").select("id,name").limit(20),
    supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("redemptions").select("id,gross_bill,net_payable,customer_id,business_id").limit(500),
    supabase.from("customers").select("id,name").limit(2000),
    loadAdminInsightSeries(supabase),
    getFollowupAuto(supabase),
  ]);

  const names = new Map((businesses ?? []).map((row) => [row.id, row.name as string]));
  const customerNames = new Map((allCustomers ?? []).map((row) => [row.id as string, row.name as string]));
  const redemptionMap = new Map((allRedemptions ?? []).map((row) => [row.id as string, row]));
  const categoryNames = new Map((categories ?? []).map((row) => [row.id as string, row.name as string]));
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

  const pendingPartners = (businesses ?? [])
    .filter((row) => row.status === "pending")
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      phone: row.phone as string,
      owner_name: (row.owner_name as string | null) ?? null,
      category: categoryNames.get(row.category_id as string) || "—",
      daily_footfall: row.daily_footfall != null ? Number(row.daily_footfall) : null,
      peak_hours: (row.peak_hours as string | null) ?? null,
      customer_type: (row.customer_type as string | null) ?? null,
      pincode: (row.pincode as string | null) ?? null,
      area: (row.area as string | null) ?? null,
      address: (row.address as string | null) ?? null,
      created_at: row.created_at as string,
    }));

  const bizList = (businesses ?? [])
    .filter((row) => row.status === "active")
    .map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    phone: row.phone as string,
    chain_id: (row.chain_id as string | null) ?? null,
  }));

  const disputeRows = (disputes ?? []).map((row) => {
    const red = redemptionMap.get(row.redemption_id as string);
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      reason: row.reason as string,
      proof_url: (row.proof_url as string | null) ?? null,
      status: row.status as string,
      business_name: red ? names.get(red.business_id as string) || "Shop" : "Shop",
      customer_name: red ? customerNames.get(red.customer_id as string) || "Customer" : "Customer",
      gross: red ? Number(red.gross_bill) : 0,
      net_payable: red ? Number(red.net_payable) : 0,
    };
  });

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <Logo />
      <h1 className="text-3xl font-bold text-brand-blue">Nukkad Network Admin</h1>
      <p className="text-sm text-brand-black/60">Yeh URL public home par nahi dikhta.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-brand-blue p-4 text-white">
          <p className="text-sm text-brand-yellow">Customers (scan)</p>
          <p className="text-3xl font-bold">{customerRows.length}</p>
        </div>
        <div className="rounded-2xl border border-brand-blue/20 bg-white p-4">
          <p className="text-sm text-brand-blue/70">Partners</p>
          <p className="text-3xl font-bold text-brand-black">
            {(businesses ?? []).filter((row) => row.status === "active").length}
          </p>
        </div>
        <div className="rounded-2xl bg-brand-yellow/80 p-4 text-brand-black">
          <p className="text-sm font-semibold">Visit pending</p>
          <p className="text-3xl font-bold">{pending}</p>
        </div>
        <div className="rounded-2xl border border-brand-blue/20 bg-white p-4">
          <p className="text-sm text-brand-blue/70">Redeemed visits</p>
          <p className="text-3xl font-bold text-brand-black">{redeemed}</p>
        </div>
      </div>
      <AdminInsights weekly={insights.weekly} byCategory={insights.byCategory} />
      <AdminPendingPartners pending={pendingPartners} />
      <AdminMergeChains businesses={bizList} />
      <AdminDisputes rows={disputeRows} />
      <AdminFollowupSettings followupAuto={followupAuto} />
      <ReferralCustomerPanel title="Customers — scan & redeem" rows={customerRows} showSource />
      <section>
        <h2 className="mb-4 text-2xl font-bold text-brand-blue">Settlements</h2>
        <AdminSettlements rows={rows} />
      </section>
    </main>
  );
}

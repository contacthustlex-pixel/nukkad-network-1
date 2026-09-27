import { cookies } from "next/headers";
import { AdminLogin } from "@/components/admin-login";
import { AdminSettlements } from "@/components/admin-settlements";
import { Logo } from "@/components/logo";
import { readAdmin } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase-server";

export default async function AdminPage() {
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
  const [{ data: settlements }, { data: businesses }] = await Promise.all([
    supabase.from("settlements").select("*").order("week_start", { ascending: false }).limit(100),
    supabase.from("businesses").select("id,name").limit(100),
  ]);
  const names = new Map((businesses ?? []).map((row) => [row.id, row.name as string]));
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Logo />
      <h1 className="mt-4 mb-6 text-3xl font-bold">Settlements</h1>
      <AdminSettlements rows={rows} />
    </main>
  );
}

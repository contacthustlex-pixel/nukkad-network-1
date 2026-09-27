import Link from "next/link";
import { Logo } from "@/components/logo";
import { createServiceClient } from "@/lib/supabase-server";

export default async function MyCodePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: active } = await supabase.rpc("get_active_code", { phone: token });
  const { data: customers } = await supabase.from("customers").select("*").eq("phone", token).limit(1);
  const customer = customers?.[0];
  const { data: redemptions } = customer
    ? await supabase
        .from("redemptions")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const { data: businesses } = await supabase.from("businesses").select("id,name").limit(200);
  const names = new Map((businesses ?? []).map((row) => [row.id, row.name as string]));

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <Logo />
      <h1 className="text-2xl font-bold text-navy">{customer?.name || "Mera code"}</h1>
      {active?.code ? (
        <section className="rounded-3xl bg-white p-5 text-center shadow">
          <p className="text-sm text-navy/70">Active code</p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-navy">{active.code}</p>
          <p className="mt-2 text-sm text-navy/70">
            {new Date(active.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} tak
          </p>
          <Link href={`/shops?c=${active.code}`} className="mt-4 inline-block font-semibold text-navy underline">
            Linked shops
          </Link>
        </section>
      ) : (
        <p className="rounded-2xl bg-white p-4 text-navy">Abhi koi active code nahi hai.</p>
      )}
      <h2 className="text-lg font-semibold text-navy">History</h2>
      <ol className="space-y-3">
        {(redemptions ?? []).map((row) => (
          <li key={row.id} className="rounded-2xl bg-white p-4 shadow">
            <p className="font-semibold text-navy">{names.get(row.business_id) ?? "Shop"}</p>
            <p className="text-sm text-navy/70">
              Bill ₹{row.gross_bill} · discount ₹{row.discount} · pay ₹{row.net_payable}
            </p>
            <p className="text-xs text-navy/50">
              {new Date(row.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </p>
          </li>
        ))}
        {(redemptions ?? []).length === 0 ? <li className="text-sm text-navy/70">Abhi koi visit nahi.</li> : null}
      </ol>
    </main>
  );
}

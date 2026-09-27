import Link from "next/link";
import { ComplaintForm } from "@/components/complaint-form";
import { createServiceClient } from "@/lib/supabase-server";
import { Logo } from "@/components/logo";

export default async function ComplaintPage({
  params,
}: {
  params: Promise<{ redemptionId: string }>;
}) {
  const { redemptionId } = await params;
  const supabase = createServiceClient();
  const { data: reds } = await supabase.from("redemptions").select("*").eq("id", redemptionId).limit(1);
  const redemption = reds?.[0];

  let businessName = "Shop";
  if (redemption) {
    const { data: biz } = await supabase.from("businesses").select("name").eq("id", redemption.business_id).limit(1);
    businessName = biz?.[0]?.name ?? businessName;
  }

  const { data: openDispute } = redemption
    ? await supabase.from("disputes").select("status").eq("redemption_id", redemptionId).eq("status", "pending").limit(1)
    : { data: [] };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Logo />
      <h1 className="mt-6 text-2xl font-bold text-brand-blue">Complaint</h1>
      {redemption ? (
        <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-brand-blue/70">{businessName}</p>
          <p className="font-bold">
            Bill ₹{redemption.gross_bill} · discount ₹{redemption.discount} · pay ₹{redemption.net_payable}
          </p>
          <p className="mt-2 text-sm text-brand-black/80">
            Shop owner ne galat amount daala? Reason likho — 48 ghante mein verify karenge.
          </p>
          {openDispute?.[0] ? (
            <p className="mt-4 rounded-xl bg-brand-yellow/30 px-4 py-3 text-sm font-semibold">
              Is redemption par pehle se complaint pending hai.
            </p>
          ) : (
            <ComplaintForm redemptionId={redemptionId} />
          )}
          <Link href="/about" className="mt-4 inline-block font-semibold text-brand-blue underline">
            Wapas About
          </Link>
        </section>
      ) : (
        <p className="mt-4 text-brand-black/70">Yeh redemption nahi mili.</p>
      )}
    </main>
  );
}

import { createServiceClient } from "@/lib/supabase-server";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default async function ComplaintPage({
  params,
}: {
  params: Promise<{ redemptionId: string }>;
}) {
  const { redemptionId } = await params;
  const supabase = createServiceClient();
  const { data: reds } = await supabase.from("redemptions").select("*").eq("id", redemptionId).limit(1);
  const redemption = reds?.[0];

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Logo />
      <h1 className="mt-6 text-2xl font-bold text-brand-blue">Complaint</h1>
      {redemption ? (
        <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-brand-blue/70">Redemption</p>
          <p className="font-bold">
            Bill ₹{redemption.gross_bill} · discount ₹{redemption.discount} · pay ₹{redemption.net_payable}
          </p>
          <p className="mt-4 text-sm text-brand-black/80">
            Salon owner ne galat amount daala? Reason likho — 48 ghante mein verify karenge. (Full upload flow Phase 8.)
          </p>
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

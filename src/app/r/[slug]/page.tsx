import { notFound } from "next/navigation";
import { CustomerJoin } from "@/components/customer-join";
import { Logo } from "@/components/logo";
import { createServiceClient } from "@/lib/supabase-server";

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .limit(1);
  if (error) {
    return <p className="p-6 text-navy">Shop load nahi hui. Thodi der baad try karo.</p>;
  }
  const business = businesses?.[0];
  if (!business) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("id,name")
    .eq("id", business.category_id)
    .limit(1);
  const category = categories?.[0]?.name ?? "Shop";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-4 py-8">
      <Logo />
      {business.status !== "active" ? (
        <section className="rounded-3xl bg-white p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-navy">{business.name}</h1>
          <p className="mt-3 text-lg text-navy">Ye shop abhi available nahi.</p>
        </section>
      ) : (
        <CustomerJoin business={{ id: business.id, name: business.name, category }} />
      )}
    </main>
  );
}

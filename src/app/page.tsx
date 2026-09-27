import Link from "next/link";
import { Logo } from "@/components/logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 px-4 py-16">
      <Logo className="text-3xl" />
      <p className="text-lg text-navy">Mukherjee Nagar ke shops ka referral network.</p>
      <p className="text-navy/80">Shop ka QR scan karo, code lo, agle dukaan par discount.</p>
      <Link href="/about" className="w-fit rounded-full bg-amber px-5 py-3 font-semibold text-navy">
        About
      </Link>
    </main>
  );
}

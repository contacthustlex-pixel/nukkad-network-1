import Link from "next/link";
import { Logo } from "@/components/logo";

export default function PartnerKitPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-6 text-3xl font-bold text-brand-blue">Partner table kit</h1>
      <p className="mt-3 text-brand-black/80">
        Chain merge ke baad QR download karo, print karke table par lagao. Customer scan karega → naam + phone + OTP →
        code WhatsApp par.
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-brand-black/90">
        <li>Partner login → QR poster download (sirf merged chain par).</li>
        <li>A4 print — QR size kam se kam 4×4 cm.</li>
        <li>Bill par code: pehle amount, phir customer ka NK-code.</li>
        <li>Sunday settle — Monday unpaid par shop block (UPI nukkad@upi).</li>
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/partner" className="rounded-full bg-brand-blue px-5 py-3 font-semibold text-white">
          Partner login
        </Link>
        <Link href="/api/partner/qr" className="rounded-full bg-brand-yellow px-5 py-3 font-bold text-brand-black">
          QR download
        </Link>
        <Link href="/" className="rounded-full border border-brand-blue/30 px-5 py-3 font-semibold text-brand-blue">
          Home
        </Link>
      </div>
    </main>
  );
}

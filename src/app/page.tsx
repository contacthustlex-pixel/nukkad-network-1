import Link from "next/link";
import { Logo } from "@/components/logo";

const sections = [
  {
    title: "Customer — QR scan",
    desc: "Shop ka QR scan karo, naam + phone, OTP. Code WhatsApp par. Referrer dashboard par detail jati hai.",
    href: "/r/sharma-cafe",
    cta: "Demo QR scan",
  },
  {
    title: "Partner — bill + code",
    desc: "Redeem par pehle bill amount, phir customer code. Valid code par 10% discount + WhatsApp confirm.",
    href: "/partner",
    cta: "Partner desk",
  },
  {
    title: "Partner login",
    desc: "Approved partner: OTP se login, referred customers dekho, redemption karo.",
    href: "/partner",
    cta: "Login",
  },
  {
    title: "Partner signup",
    desc: "Nayi shop? Footfall, peak hours, customer type bhejo. Admin approve + chain merge ke baad QR milega.",
    href: "/partner/signup",
    cta: "Signup apply",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-3xl bg-brand-blue px-6 py-10 text-white">
        <Logo className="text-3xl [&_span]:text-brand-yellow" />
        <p className="mt-4 max-w-xl text-lg text-white/90">
          Mukherjee Nagar referral network — blue, yellow, white, black.
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="flex flex-col rounded-2xl border border-brand-blue/15 bg-brand-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-bold text-brand-blue">{section.title}</h2>
            <p className="mt-2 flex-1 text-sm text-brand-black/80">{section.desc}</p>
            <Link
              href={section.href}
              className="mt-4 inline-block w-fit rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-black"
            >
              {section.cta}
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-brand-black/50">
        <Link href="/about" className="underline">
          About Nukkad Network
        </Link>
      </p>
    </main>
  );
}

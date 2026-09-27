import Link from "next/link";
import { Logo } from "@/components/logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/partner", label: "Partner login" },
  { href: "/partner/signup", label: "Partner signup" },
];

export function SiteNav() {
  return (
    <header className="border-b border-brand-blue/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/">
          <Logo className="text-xl" />
        </Link>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-brand-blue hover:bg-brand-yellow/30"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

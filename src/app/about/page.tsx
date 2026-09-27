import { Logo } from "@/components/logo";

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <Logo />
      <h1 className="text-2xl font-bold text-navy">About</h1>
      <p className="text-navy/80">Connecting customers to the best shops of your nukkad.</p>
    </main>
  );
}

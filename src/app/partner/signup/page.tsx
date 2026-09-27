import { Logo } from "@/components/logo";
import { PartnerSignupForm } from "@/components/partner-signup";

export default function PartnerSignupPage() {
  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Logo />
        <PartnerSignupForm />
      </div>
    </main>
  );
}

import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <AuthForm mode="signup" />
      </main>
    </>
  );
}

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="px-4 pb-10 pt-16 md:px-8">
      <div className="panel mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            SportStack
          </p>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Live football data, managed API keys, rate-limited access, and a developer-first dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          <Link href="/docs" className="hover:text-[var(--foreground)]">
            Documentation
          </Link>
          <Link href="/login" className="hover:text-[var(--foreground)]">
            Login
          </Link>
          <Link href="/signup" className="hover:text-[var(--foreground)]">
            Signup
          </Link>
        </div>
      </div>
    </footer>
  );
}


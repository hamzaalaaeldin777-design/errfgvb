"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/", label: "Overview" },
  { href: "/docs", label: "Docs" },
  { href: "/#pricing", label: "Pricing" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 md:px-8">
      <div className="panel mx-auto flex max-w-7xl items-center justify-between rounded-full px-5 py-3">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.28em] uppercase">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-slate-950">
            SS
          </span>
          SportStack
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "text-[var(--foreground)]" : "hover:text-[var(--foreground)]"}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href={user.role === "admin" ? "/admin" : "/dashboard"}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5"
              >
                {user.role === "admin" ? "Admin" : "Dashboard"}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 sm:inline-flex"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Start free
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}


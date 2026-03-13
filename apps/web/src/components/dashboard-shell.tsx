"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, LogOut, Shield } from "lucide-react";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-toggle";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  adminOnly?: boolean;
  children: React.ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  adminOnly = false,
  children,
}: DashboardShellProps) {
  const router = useRouter();
  const { clearSession, ready, user } = useAuth();

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (adminOnly && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [adminOnly, ready, router, user]);

  if (!ready || !user || (adminOnly && user.role !== "admin")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">
        <div className="panel rounded-[2rem] px-8 py-10 text-center">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted)]">
            SportStack
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Loading workspace</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="panel mb-8 flex flex-col gap-5 rounded-[2rem] px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-[var(--muted)]">
              {adminOnly ? <Shield className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
              <span className="text-xs font-semibold uppercase tracking-[0.28em]">
                {adminOnly ? "Admin Console" : "Developer Dashboard"}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5">
              Home
            </Link>
            <Link href="/docs" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5">
              Docs
            </Link>
            {!adminOnly && user.role === "admin" ? (
              <Link href="/admin" className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5">
                Admin
              </Link>
            ) : null}
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-slate-950"
              onClick={() => {
                clearSession();
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "./auth-provider";
import type { User } from "@/lib/types";

type AuthFormProps = {
  mode: "login" | "signup";
};

type AuthResponse = {
  token: string;
  user: User;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: mode === "login" ? "demo@sportstack.dev" : "",
    password: mode === "login" ? "Demo123!" : "",
  });

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = await apiFetch<AuthResponse>(
        isSignup ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: isSignup
            ? form
            : {
                email: form.email,
                password: form.password,
              },
        },
      );

      setSession(payload.token, payload.user);
      startTransition(() => {
        router.push(payload.user.role === "admin" ? "/admin" : "/dashboard");
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to authenticate.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-strong glow-border grid overflow-hidden rounded-[2rem] lg:grid-cols-[1.1fr_0.9fr]">
      <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
        <p className="eyebrow">{isSignup ? "Build your product" : "Welcome back"}</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          {isSignup ? "Launch with live football data in one evening." : "Reconnect to your API workspace."}
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-7 text-[var(--muted)]">
          SportStack gives you live scores, fixtures, standings, API key management, plan controls, and an admin
          view from the same stack.
        </p>

        <div className="mt-8 space-y-4 text-sm text-[var(--muted)]">
          <div className="panel rounded-2xl p-4">
            <p className="font-medium text-[var(--foreground)]">Seeded demo access</p>
            <p className="mt-2 mono text-xs">Developer: demo@sportstack.dev / Demo123!</p>
            <p className="mt-1 mono text-xs">Admin: admin@sportstack.dev / Admin123!</p>
          </div>
          <div className="panel rounded-2xl p-4">
            <p className="font-medium text-[var(--foreground)]">Local demo API key</p>
            <p className="mt-2 mono text-xs">sport_live_demo_free_2026_local</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignup ? (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 outline-none focus:border-[var(--brand)]"
                  placeholder="Ada Lovelace"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Company</span>
                <input
                  value={form.company}
                  onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 outline-none focus:border-[var(--brand)]"
                  placeholder="MatchLab"
                />
              </label>
            </>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 outline-none focus:border-[var(--brand)]"
              placeholder="you@company.com"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 outline-none focus:border-[var(--brand)]"
              placeholder="••••••••"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Working..." : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-[var(--muted)]">
          {isSignup ? "Already have an account?" : "Need a fresh workspace?"}{" "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-medium text-[var(--foreground)]"
          >
            {isSignup ? "Log in" : "Start free"}
          </Link>
        </p>
      </div>
    </div>
  );
}


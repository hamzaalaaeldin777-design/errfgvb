"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { ChartNoAxesColumn, KeyRound, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ApiKeyRecord, DashboardOverview, PlanId } from "@/lib/types";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";

type KeysResponse = {
  keys: ApiKeyRecord[];
};

type NewKeyResponse = {
  apiKey: string;
};

export default function DashboardPage() {
  const { refreshUser, token, user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState("Primary production key");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDashboard = useEffectEvent(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [overviewPayload, keysPayload] = await Promise.all([
        apiFetch<DashboardOverview>("/dashboard/overview", { token }),
        apiFetch<KeysResponse>("/dashboard/keys", { token }),
      ]);

      setOverview(overviewPayload);
      setKeys(keysPayload.keys);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (token) {
      void loadDashboard();
    }
  }, [token]);

  async function createKey() {
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch<NewKeyResponse>("/dashboard/keys", {
        method: "POST",
        token,
        body: { name: newKeyName },
      });
      setRevealedKey(response.apiKey);
      setNewKeyName("Secondary key");
      await loadDashboard();
    } catch (keyError) {
      setError(keyError instanceof Error ? keyError.message : "Unable to create API key.");
    } finally {
      setSaving(false);
    }
  }

  async function regenerateKey(id: string) {
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch<NewKeyResponse>(`/dashboard/keys/${id}/regenerate`, {
        method: "POST",
        token,
      });
      setRevealedKey(response.apiKey);
      await loadDashboard();
    } catch (regenerateError) {
      setError(
        regenerateError instanceof Error
          ? regenerateError.message
          : "Unable to regenerate API key.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(id: string) {
    if (!token || !window.confirm("Revoke this API key?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/dashboard/keys/${id}/revoke`, {
        method: "POST",
        token,
      });
      await loadDashboard();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke API key.");
    } finally {
      setSaving(false);
    }
  }

  async function changePlan(plan: PlanId) {
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch("/dashboard/plan", {
        method: "POST",
        token,
        body: { plan },
      });
      await refreshUser();
      await loadDashboard();
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to update plan.");
    } finally {
      setSaving(false);
    }
  }

  const usageBars = overview?.usage.daily.length
    ? overview.usage.daily
    : [
        { day: "Mon", total: 0 },
        { day: "Tue", total: 0 },
        { day: "Wed", total: 0 },
      ];

  return (
    <DashboardShell
      title="Developer dashboard"
      subtitle="Generate API keys, inspect daily usage, monitor rate limits, and upgrade plans without leaving the app."
    >
      {error ? (
        <div className="mb-6 rounded-[1.75rem] border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {revealedKey ? (
        <div className="panel mb-6 rounded-[2rem] p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">New API key</p>
              <p className="mt-3 text-lg font-semibold">Copy this now. It will not be shown again.</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
              onClick={() => setRevealedKey(null)}
            >
              Hide
            </button>
          </div>
          <pre className="mono mt-4 overflow-x-auto rounded-[1.5rem] bg-slate-950/92 p-4 text-sm text-cyan-100">
            {revealedKey}
          </pre>
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-4">
        {[
          ["Requests today", overview?.usage.today ?? 0],
          ["Remaining", overview?.usage.remaining ?? (overview?.usage.limit === null ? "Unlimited" : 0)],
          ["7-day total", overview?.usage.sevenDayTotal ?? 0],
          ["Active keys", keys.filter((key) => key.status === "active").length],
        ].map(([label, value]) => (
          <article key={label as string} className="panel rounded-[2rem] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
            <p className="mt-4 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="panel rounded-[2rem] p-6">
          <div className="flex items-center gap-3">
            <ChartNoAxesColumn className="h-5 w-5 text-[var(--brand)]" />
            <div>
              <p className="eyebrow">Usage snapshot</p>
              <h2 className="mt-2 text-2xl font-semibold">Daily request volume</h2>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-7">
            {usageBars.map((bar) => {
              const maxValue = Math.max(...usageBars.map((entry) => entry.total), 1);
              const height = Math.max(12, (bar.total / maxValue) * 180);
              return (
                <div key={bar.day} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center">
                  <div className="mx-auto flex h-48 items-end justify-center">
                    <div
                      className="w-12 rounded-full bg-[linear-gradient(180deg,var(--brand),var(--brand-deep))]"
                      style={{ height }}
                    />
                  </div>
                  <p className="mt-3 text-sm font-medium">{bar.day}</p>
                  <p className="text-xs text-[var(--muted)]">{bar.total}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {(overview?.usage.topEndpoints ?? []).map((endpoint) => (
              <div key={endpoint.endpoint} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="mono text-xs text-cyan-200">{endpoint.endpoint}</p>
                <p className="mt-2 text-lg font-semibold">{endpoint.total}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel rounded-[2rem] p-6">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-[var(--brand)]" />
            <div>
              <p className="eyebrow">Key management</p>
              <h2 className="mt-2 text-2xl font-semibold">Generate and rotate credentials</h2>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <input
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 outline-none focus:border-[var(--brand)]"
              placeholder="Primary production key"
            />
            <button
              type="button"
              className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-slate-950 disabled:opacity-60"
              onClick={() => void createKey()}
              disabled={saving}
            >
              Create
            </button>
          </div>
          <div className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-[var(--muted)]">Loading keys...</p>
            ) : (
              keys.map((key) => (
                <div key={key.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{key.name}</p>
                      <p className="mono mt-1 text-xs text-cyan-200">{key.prefix}...</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                        {key.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        onClick={() => void regenerateKey(key.id)}
                        disabled={saving || key.status === "disabled"}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Regenerate
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        onClick={() => void revokeKey(key.id)}
                        disabled={saving || key.status !== "active"}
                      >
                        <Trash2 className="h-4 w-4" />
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        {[
          {
            id: "free",
            title: "Free",
            price: "$0",
            copy: "100 requests/day for prototypes and local development.",
          },
          {
            id: "pro",
            title: "Pro",
            price: "$49",
            copy: "10,000 requests/day for public apps and internal tools.",
          },
          {
            id: "enterprise",
            title: "Enterprise",
            price: "Custom",
            copy: "Unlimited requests and operator-level support.",
          },
        ].map((plan) => (
          <article key={plan.id} className="panel rounded-[2rem] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">{plan.title}</p>
                <p className="mt-3 text-3xl font-semibold">{plan.price}</p>
              </div>
              {user?.plan === plan.id ? (
                <span className="rounded-full bg-[var(--brand)]/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand)]">
                  Current
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{plan.copy}</p>
            <button
              type="button"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-medium hover:bg-white/5 disabled:opacity-60"
              onClick={() => void changePlan(plan.id as PlanId)}
              disabled={saving || user?.plan === plan.id}
            >
              <Sparkles className="h-4 w-4" />
              {user?.plan === plan.id ? "Already active" : "Switch plan"}
            </button>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}


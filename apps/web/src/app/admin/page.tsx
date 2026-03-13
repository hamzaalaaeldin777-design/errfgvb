"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Ban, ChartPie, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { AdminUsageResponse, AdminUsersResponse } from "@/lib/types";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";

export default function AdminPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUsersResponse["users"]>([]);
  const [usage, setUsage] = useState<AdminUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdmin = useEffectEvent(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [usersPayload, usagePayload] = await Promise.all([
        apiFetch<AdminUsersResponse>("/admin/users", { token }),
        apiFetch<AdminUsageResponse>("/admin/usage", { token }),
      ]);

      setUsers(usersPayload.users);
      setUsage(usagePayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (token) {
      void loadAdmin();
    }
  }, [token]);

  async function disableKey(id: string) {
    if (!token || !window.confirm("Disable this API key?")) {
      return;
    }

    try {
      await apiFetch(`/admin/api-keys/${id}/disable`, {
        method: "POST",
        token,
      });
      await loadAdmin();
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Unable to disable API key.",
      );
    }
  }

  return (
    <DashboardShell
      title="Admin panel"
      subtitle="Review users, inspect consumption patterns, and disable problem keys before they hit your infrastructure."
      adminOnly
    >
      {error ? (
        <div className="mb-6 rounded-[1.75rem] border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="panel rounded-[2rem] p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-[var(--brand)]" />
            <div>
              <p className="eyebrow">Users</p>
              <p className="mt-2 text-3xl font-semibold">{users.length}</p>
            </div>
          </div>
        </article>
        <article className="panel rounded-[2rem] p-5">
          <div className="flex items-center gap-3">
            <ChartPie className="h-5 w-5 text-[var(--brand)]" />
            <div>
              <p className="eyebrow">Endpoints</p>
              <p className="mt-2 text-3xl font-semibold">{usage?.endpoints.length ?? 0}</p>
            </div>
          </div>
        </article>
        <article className="panel rounded-[2rem] p-5">
          <div className="flex items-center gap-3">
            <Ban className="h-5 w-5 text-[var(--brand)]" />
            <div>
              <p className="eyebrow">Disabled keys</p>
              <p className="mt-2 text-3xl font-semibold">
                {users.flatMap((user) => user.keys).filter((key) => key.status === "disabled").length}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="panel rounded-[2rem] p-6">
          <p className="eyebrow">Top endpoints</p>
          <h2 className="mt-3 text-2xl font-semibold">Last 24 hours</h2>
          <div className="mt-6 space-y-3">
            {(usage?.endpoints ?? []).map((entry) => (
              <div key={entry.endpoint} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <code className="mono text-xs text-cyan-200">{entry.endpoint}</code>
                  <span className="text-sm font-semibold">{entry.total}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel rounded-[2rem] p-6">
          <p className="eyebrow">Top consumers</p>
          <h2 className="mt-3 text-2xl font-semibold">Plan and request breakdown</h2>
          <div className="mt-6 space-y-3">
            {(usage?.topConsumers ?? []).map((consumer) => (
              <div key={consumer.email} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{consumer.email}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{consumer.plan}</p>
                  </div>
                  <span className="text-sm font-semibold">{consumer.total}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel rounded-[2rem] p-6">
          <p className="eyebrow">Users and keys</p>
          <h2 className="mt-3 text-2xl font-semibold">Developer accounts</h2>
          <div className="mt-6 space-y-4">
            {loading ? (
              <p className="text-sm text-[var(--muted)]">Loading users...</p>
            ) : (
              users.map((account) => (
                <div key={account.id} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{account.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{account.email}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                        {account.plan} plan • {account.requestCountToday} requests today
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      {account.role}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {account.keys.map((key) => (
                      <div key={key.id} className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium">{key.name}</p>
                            <p className="mono mt-1 text-xs text-cyan-200">{key.prefix}...</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                              {key.status}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                            onClick={() => void disableKey(key.id)}
                            disabled={key.status === "disabled"}
                          >
                            Disable key
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel rounded-[2rem] p-6">
          <p className="eyebrow">Recent requests</p>
          <h2 className="mt-3 text-2xl font-semibold">Latest traffic</h2>
          <div className="mt-6 space-y-3">
            {(usage?.recentRequests ?? []).map((request, index) => (
              <div key={`${request.endpoint}-${index}`} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="mono text-xs text-cyan-200">{request.endpoint}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      {request.method} • {request.email ?? "Unknown user"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{request.status_code}</p>
                    <p className="text-xs text-[var(--muted)]">{request.response_time_ms} ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}

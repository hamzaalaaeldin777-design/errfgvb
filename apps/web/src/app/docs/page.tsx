import Link from "next/link";
import { ArrowUpRight, FileSearch2, Radar, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  authChecks,
  coverageNotes,
  docsSources,
  implementedEndpoints,
  multiSportCatalog,
  officialReferenceGroups,
  platformNotes,
  rateLimitPlans,
} from "@/lib/docs-reference";

export default function DocsPage() {
  return (
    <>
      <SiteHeader />
      <main className="px-4 pb-12 md:px-8">
        <section className="mx-auto max-w-7xl pt-8">
          <div className="panel-strong rounded-[2.5rem] px-6 py-10 md:px-10">
            <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="eyebrow">Documentation</p>
                <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl">
                  Multi-sport API docs with full structured coverage and a verified live board across the supported catalog.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
                  SportStack serves a developer-facing sports API, a JWT-secured dashboard, and a live worker that
                  refreshes the current board across the supported sports catalog. The sections below show the
                  endpoints that work today together with the broader API-Football-style reference surface used as a
                  parity roadmap.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/signup"
                    className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/5"
                  >
                    Open dashboard
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                <div className="panel rounded-[2rem] p-5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-cyan-300" />
                    <p className="text-sm font-semibold">Auth model</p>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    Public data endpoints use <code className="mono text-cyan-200">x-api-key</code>. Dashboard and
                    admin actions use JWT bearer tokens.
                  </p>
                </div>
                <div className="panel rounded-[2rem] p-5">
                  <div className="flex items-center gap-3">
                    <Radar className="h-5 w-5 text-cyan-300" />
                    <p className="text-sm font-semibold">Live board</p>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    The worker writes a shared live snapshot, so <code className="mono text-cyan-200">/api/fixtures/live</code>{" "}
                    can expose football, basketball, tennis, esports, and the rest of the current live board instead of
                    a single seeded demo row.
                  </p>
                </div>
                <div className="panel rounded-[2rem] p-5">
                  <div className="flex items-center gap-3">
                    <FileSearch2 className="h-5 w-5 text-cyan-300" />
                    <p className="text-sm font-semibold">Reference source</p>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                    {docsSources.map((source) => (
                      <Link
                        key={source.href}
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-cyan-200 transition hover:text-cyan-100"
                      >
                        <span>{source.label}</span>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-7xl">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              {authChecks.map((check) => (
                <article key={check.title} className="panel rounded-[2rem] p-6">
                  <p className="eyebrow">{check.title}</p>
                  <pre className="mono mt-4 overflow-x-auto rounded-[1.5rem] bg-slate-950/92 p-4 text-sm leading-7 text-cyan-100">
                    {check.command}
                  </pre>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{check.detail}</p>
                </article>
              ))}
            </div>

            <div className="space-y-6">
              <article className="panel rounded-[2rem] p-6">
                <p className="eyebrow">Local demo</p>
                <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
                  <p>
                    Developer login: <span className="mono text-cyan-200">demo@sportstack.dev / Demo123!</span>
                  </p>
                  <p>
                    Admin login: <span className="mono text-cyan-200">admin@sportstack.dev / Admin123!</span>
                  </p>
                  <p>
                    Demo API key: <span className="mono text-cyan-200">sport_live_demo_free_2026_local</span>
                  </p>
                </div>
              </article>

              <article className="panel rounded-[2rem] p-6">
                <p className="eyebrow">Platform notes</p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                  {platformNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </article>

              <article className="panel rounded-[2rem] p-6">
                <p className="eyebrow">Rate limits</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {rateLimitPlans.map(([name, value]) => (
                    <div key={name} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{value}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-7xl">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Coverage model</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                {coverageNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </article>

            <article className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Supported sports</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {multiSportCatalog.map((sport) => (
                  <div
                    key={sport.slug}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
                  >
                    <span>{sport.name}</span>
                    <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {sport.coverage === "full" ? "full" : "live"}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-7xl">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Implemented now</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Current SportStack REST endpoints.</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
              These are the endpoints wired into the running API today. Every request below requires an API key in the
              <code className="mono mx-1 text-cyan-200">x-api-key</code> header.
            </p>
          </div>

          <div className="space-y-6">
            {implementedEndpoints.map((endpoint) => (
              <article key={endpoint.path} className="panel rounded-[2rem] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                        {endpoint.method}
                      </span>
                      <code className="mono text-sm text-cyan-200">{endpoint.path}</code>
                    </div>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">{endpoint.description}</p>
                    <p className="mt-3 text-sm">
                      <span className="font-medium text-[var(--foreground)]">Parameters:</span>{" "}
                      <span className="text-[var(--muted)]">{endpoint.params}</span>
                    </p>
                  </div>
                  <Link
                    href="/signup"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5"
                  >
                    Generate a key
                  </Link>
                </div>
                <pre className="mono mt-6 overflow-x-auto rounded-[1.75rem] bg-slate-950/92 p-5 text-sm leading-7 text-cyan-100">
                  {endpoint.response}
                </pre>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-7xl">
          <div className="mb-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow">Football reference model</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">API-Football-style endpoint coverage.</h2>
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">
              This matrix is based on the official API-Football v3 documentation structure. It is included here so the
              platform has a full roadmap-grade football reference, while the sections above stay strict about what the
              current build already serves across the wider sports catalog.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {officialReferenceGroups.map((group) => (
              <article key={group.title} className="panel rounded-[2rem] p-6">
                <p className="eyebrow">{group.title}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{group.description}</p>
                <div className="mt-6 space-y-4">
                  {group.routes.map((route) => (
                    <div
                      key={route.path}
                      className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <code className="mono text-sm text-cyan-200">{route.path}</code>
                        <span className="rounded-full border border-cyan-400/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-300">
                          GET
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{route.summary}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Key filters</p>
                      <p className="mt-1 text-sm text-[var(--foreground)]">{route.filters}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

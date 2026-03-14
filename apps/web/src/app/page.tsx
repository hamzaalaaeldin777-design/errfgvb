import Link from "next/link";
import { ArrowRight, Cable, ChartColumnIncreasing, Database, Globe, ShieldCheck, Zap } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { supportedSports } from "@/lib/sports-catalog";

const features = [
  {
    title: "Full multi-sport data model",
    description: "Leagues, teams, players, fixtures, live scores, and standings behind a single key across the supported sports catalog.",
    icon: Globe,
  },
  {
    title: "Developer usage analytics",
    description: "Daily volume, rate limits, top endpoints, and key-level request visibility in one dashboard.",
    icon: ChartColumnIncreasing,
  },
  {
    title: "Redis-backed rate limiting",
    description: "Plan-based limits enforced in real time with predictable Free, Pro, and Enterprise behavior.",
    icon: Zap,
  },
  {
    title: "JWT auth and key control",
    description: "Separate user sessions from API access keys, with regeneration, revoke, and admin disable actions.",
    icon: ShieldCheck,
  },
  {
    title: "PostgreSQL data model",
    description: "Structured league, team, player, fixture, event, and standings tables with example seed data.",
    icon: Database,
  },
  {
    title: "Multi-sport live ingestion",
    description: "A Python live scraper with HTTP/2, throttling, retries, and a browser fallback that now spans football, basketball, tennis, esports, and the broader sport catalog.",
    icon: Cable,
  },
];

const pricing = [
  { name: "Free", price: "$0", limit: "100 requests/day", cta: "Create sandbox", href: "/signup" },
  { name: "Pro", price: "$49", limit: "10,000 requests/day", cta: "Upgrade in dashboard", href: "/dashboard" },
  { name: "Enterprise", price: "Custom", limit: "Unlimited", cta: "Request rollout", href: "/docs" },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="px-4 pb-12 md:px-8">
        <section className="mx-auto grid max-w-7xl gap-6 pt-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="panel-strong glow-border rounded-[2.5rem] px-6 py-10 md:px-10 md:py-14">
            <p className="eyebrow">Modern Sports Data Infrastructure</p>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
              Ship multi-sport live products without managing brittle scrapers.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              SportStack gives developers structured endpoints plus a live board across esports,
              football, tennis, basketball, baseball, volleyball, American football, handball, table tennis, ice
              hockey, darts, motorsport, cycling, cricket, MMA, rugby, futsal, badminton, water polo, snooker,
              Aussie rules, beach volleyball, minifootball, floorball, and bandy.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/5"
              >
                Explore docs
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ["Supported sports", `${supportedSports.length} structured APIs`],
                ["Structured depth", "All sports + dashboard controls"],
                ["Deployment", "Docker-ready stack"],
              ].map(([label, value]) => (
                <div key={label} className="panel rounded-[1.75rem] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
                  <p className="mt-2 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel rounded-[2.5rem] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Live response preview</p>
                  <h2 className="mt-3 text-2xl font-semibold">GET /api/fixtures/live?sport=esports</h2>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                  Active
                </span>
              </div>
              <pre className="mono mt-6 overflow-x-auto rounded-[1.75rem] bg-slate-950/92 p-5 text-sm leading-7 text-cyan-100">
{`{
  "sport_slug": "esports",
  "sport_name": "Esports",
  "match_id": 987654,
  "league": "LCK",
  "home_team": "T1",
  "away_team": "Gen.G",
  "score": "1-1",
  "status": "In Progress"
}`}
              </pre>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="panel rounded-[2rem] p-6">
                <p className="eyebrow">Auth flow</p>
                <p className="mt-3 text-2xl font-semibold">JWT for sessions, hashed API keys for traffic.</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  Developers log in with JWT sessions, then mint and rotate API keys from the dashboard without
                  exposing the stored secret hash.
                </p>
              </div>
              <div className="panel rounded-[2rem] p-6">
                <p className="eyebrow">Built to run</p>
                <p className="mt-3 text-2xl font-semibold">Next.js, Express, PostgreSQL, Redis, Docker.</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  The stack is already split into frontend, API, and ingestion services with a shared live snapshot for
                  multi-sport traffic and container config for local development and deployment.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-7xl">
          <div className="mb-8">
            <p className="eyebrow">Feature set</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">Everything you need to expose sports data as a product.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="panel rounded-[2rem] p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)]/18 text-[var(--brand)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Coverage</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight">Supported sports in the live worker.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Every listed sport now shares the same structured route family, with live and scheduled data flowing
              through the worker snapshot and the public API.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {supportedSports.map((sport) => (
              <div key={sport.slug} className="panel rounded-[1.5rem] p-4">
                <p className="text-sm font-semibold">{sport.name}</p>
                <p className="mono mt-2 text-xs text-cyan-200">{sport.slug}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  {sport.coverage === "full" ? "Full data" : "Live feed"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto mt-16 max-w-7xl">
          <div className="mb-8">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">Start small, scale to production, keep the plan logic explicit.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {pricing.map((plan, index) => (
              <article
                key={plan.name}
                className={`rounded-[2rem] p-6 ${index === 1 ? "panel-strong glow-border" : "panel"}`}
              >
                <p className="eyebrow">{plan.name}</p>
                <p className="mt-4 text-4xl font-semibold">{plan.price}</p>
                <p className="mt-3 text-sm text-[var(--muted)]">{plan.limit}</p>
                <Link
                  href={plan.href}
                  className="mt-8 inline-flex rounded-full border border-white/10 px-5 py-3 text-sm font-medium hover:bg-white/5"
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="panel rounded-[2.25rem] p-6">
            <p className="eyebrow">Documentation preview</p>
            <h2 className="mt-4 text-3xl font-semibold">A docs surface for full multi-sport coverage.</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Endpoint examples, parameters, authentication instructions, supported sport slugs, and sample JSON
              responses are all published inside the app.
            </p>
            <Link
              href="/docs"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Open docs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="panel rounded-[2.25rem] p-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                "GET /api/sports",
                "GET /api/leagues",
                "GET /api/teams?league_id=1&sport=football",
                "GET /api/players?team_id=1&sport=football",
                "GET /api/fixtures?sport=football",
                "GET /api/fixtures/live?sport=basketball",
                "GET /api/standings?league_id=1&sport=football",
              ].map((endpoint) => (
                <div key={endpoint} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="mono text-sm text-cyan-200">{endpoint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-7xl">
          <div className="panel-strong rounded-[2.5rem] px-6 py-10 text-center md:px-10">
            <p className="eyebrow">Start building</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">Use the seeded demo accounts or create your own workspace now.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              The project ships with local credentials, Docker setup, REST endpoints, a dashboard, an admin console,
              and a live ingestion worker across the broader sports catalog so you can run the full platform without
              additional scaffolding.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/signup" className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-slate-950">
                Create account
              </Link>
              <Link href="/login" className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/5">
                Open dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

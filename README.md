# SportStack

SportStack is a full-stack sports data platform inspired by API-first SaaS products such as api-sports.io, Stripe, and Vercel. The current build combines full multi-sport structured endpoints with a broader multi-sport live board.

It includes:

- A Node.js + Express REST API secured with JWT and API keys
- A Next.js frontend with a landing page, docs, dashboard, and admin panel
- PostgreSQL schema + seed data for leagues, teams, players, fixtures, events, standings, users, API keys, and usage logs
- Redis-backed daily rate limiting for Free, Pro, and Enterprise plans
- A Python live scraping worker that targets SofaScore, uses `httpx` with HTTP/2, and escalates to Playwright when direct requests are blocked
- Docker setup for running the stack locally

## Project structure

```text
apps/
  api/      Express API
  web/      Next.js frontend
  worker/   Python multi-sport live scraper
infra/
  postgres/init/
    001_schema.sql
    002_seed.sql
```

## Features

### Landing page

- Hero section explaining the sports API
- Feature grid
- Example live fixture response
- Pricing plans
- Documentation preview
- CTA blocks for signup and dashboard access

### Developer dashboard

- Login and signup flows with JWT auth
- Generate API keys
- Regenerate or revoke keys
- View request usage and top endpoints
- See daily request limits
- Switch between Free, Pro, and Enterprise plans

### API gateway

Protected public endpoints:

- `GET /api/sports`
- `GET /api/leagues`
- `GET /api/teams`
- `GET /api/players`
- `GET /api/fixtures`
- `GET /api/fixtures/live`
- `GET /api/standings`

Each endpoint requires `x-api-key`.

### Coverage model

- All supported sports expose the core structured surface:
  - Leagues
  - Teams
  - Players
  - Fixtures
  - Live fixtures
  - Standings
- The worker covers:
  - Esports
  - Football
  - Tennis
  - Basketball
  - Baseball
  - Volleyball
  - American Football
  - Handball
  - Table Tennis
  - Ice Hockey
  - Darts
  - Motorsport
  - Cycling
  - Cricket
  - MMA
  - Rugby
  - Futsal
  - Badminton
  - Water polo
  - Snooker
  - Aussie Rules
  - Beach Volleyball
  - Minifootball
  - Floorball
  - Bandy

### Admin panel

- View users and their plans
- Review recent request activity
- Monitor top endpoints and top consumers
- Disable API keys

### Worker

- Uses `httpx` with HTTP/2 and browser-like headers
- Enforces a 3-second throttle between upstream requests
- Retries non-200 responses with exponential backoff
- Falls back to Playwright browser navigation when SofaScore blocks direct requests
- Prints live matches in the required format
- Writes a shared live snapshot consumed by `GET /api/fixtures/live`
- Persists leagues, teams, players, fixtures, and standings into PostgreSQL when `DATABASE_URL` points to a real Postgres instance

## Seeded local credentials

- Developer login: `demo@sportstack.dev` / `Demo123!`
- Admin login: `admin@sportstack.dev` / `Admin123!`
- Demo API key: `sport_live_demo_free_2026_local`

## Local development

### Option 1: Docker Compose

1. Make sure Docker is installed.
2. From the project root, run:

```bash
docker compose up --build
```

Services:

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### Option 2: Run each service manually

1. Start PostgreSQL and Redis locally.
2. Initialize the database with the SQL files in `infra/postgres/init/001_schema.sql` and `infra/postgres/init/002_seed.sql`.
3. API:

```bash
cd apps/api
npm install
npm run dev
```

4. Frontend:

```bash
cd apps/web
npm install
npm run dev
```

5. Worker:

```bash
cd apps/worker
python -m pip install -r requirements.txt
python -m playwright install chromium
python main.py
```

## Vercel deployment

Vercel is a good fit for the frontend and the Express API. It is not a good fit for the long-running Playwright scraper loop, so the recommended production shape is:

- `apps/web` deployed as one Vercel project
- `apps/api` deployed as a second Vercel project
- PostgreSQL and Redis hosted externally
- The scraper worker hosted externally and pointed at the same PostgreSQL database

### 1. Deploy the frontend project

Create a Vercel project with:

- Root Directory: `apps/web`
- Framework Preset: `Next.js`

Set:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-project.vercel.app
```

### 2. Deploy the API project

Create a second Vercel project with:

- Root Directory: `apps/api`
- Framework Preset: `Other` or `Express` if Vercel auto-detects it in the dashboard

Set:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=replace-with-a-real-secret
FRONTEND_URL=https://your-web-project.vercel.app
```

Optional:

```env
SPORTS=football,basketball,tennis
```

The API entrypoint is now Vercel-safe: it exports the Express app for Vercel and only opens its own port outside Vercel.

### 3. Host the worker outside Vercel

The scraper is a persistent Python + Playwright process. Vercel Functions are request-driven, so they should not be used as the primary home for this worker.

Recommended worker targets:

- Railway
- Render
- Fly.io
- A VPS
- GitHub Actions on a schedule for lower-frequency scraping

Worker environment:

```env
DATABASE_URL=postgresql://same-database-used-by-api
REQUEST_TIMEOUT_SECONDS=20
REQUEST_THROTTLE_SECONDS=3
FETCH_INTERVAL_SECONDS=10
ENABLE_PLAYWRIGHT_FALLBACK=true
SPORTS=
```

### Railway worker setup

Railway's monorepo docs recommend setting a root directory for isolated monorepos, and Railway's Dockerfile docs state that a `Dockerfile` at the root of the source directory is used automatically. For this repo, that means:

- Connect the GitHub repo to Railway
- Create a service from the repo
- Set the service Root Directory to `apps/worker`
- Let Railway build from the `Dockerfile` already in that directory

Worker variables on Railway:

```env
DATABASE_URL=postgresql://same-database-used-by-api
REQUEST_TIMEOUT_SECONDS=20
REQUEST_THROTTLE_SECONDS=3
FETCH_INTERVAL_SECONDS=10
ENABLE_PLAYWRIGHT_FALLBACK=true
SPORTS=
PYTHONIOENCODING=utf-8
```

Recommended Railway add-ons:

- PostgreSQL
- Redis if you also choose to host the API on Railway instead of Vercel

If you want automatic redeploys, Railway's GitHub autodeploy docs note that services linked to a GitHub repo deploy automatically when new commits hit the connected branch.

### 4. Point CORS back to the web deployment

Make sure the API project's `FRONTEND_URL` matches your Vercel frontend domain exactly, for example:

```env
FRONTEND_URL=https://sportstack-web.vercel.app
```

### 5. Production notes

- Do not use `memory://` database or Redis URLs on Vercel.
- Use a real hosted PostgreSQL instance for structured data.
- Use a real hosted Redis instance for rate limiting.
- The live worker should share the same PostgreSQL database as the API so `GET /api/fixtures/live` has fresh data even without local filesystem snapshots.

## Environment variables

Create a `.env` file at the repository root or set variables per service:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sportsstack
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-secure-jwt-secret
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
LIVE_SNAPSHOT_PATH=.codex-runtime/live-matches.json
SPORTS=
REQUEST_TIMEOUT_SECONDS=20
REQUEST_THROTTLE_SECONDS=3
FETCH_INTERVAL_SECONDS=10
ENABLE_PLAYWRIGHT_FALLBACK=true
```

`SPORTS` is optional. If you leave it empty, the worker scrapes the full supported sports catalog. If you set it, use comma-separated slugs such as `football,basketball,tennis`.

## API examples

### Sports index

```bash
curl --request GET \
  --url http://localhost:4000/api/sports \
  --header 'x-api-key: sport_live_demo_free_2026_local'
```

### Login

```bash
curl --request POST \
  --url http://localhost:4000/auth/login \
  --header 'Content-Type: application/json' \
  --data '{"email":"demo@sportstack.dev","password":"Demo123!"}'
```

### Multi-sport live fixtures

```bash
curl --request GET \
  --url 'http://localhost:4000/api/fixtures/live?sport=basketball&limit=20' \
  --header 'x-api-key: sport_live_demo_free_2026_local'
```

Example response shape:

```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "sport_slug": "basketball",
      "sport_name": "Basketball",
      "match_id": 1523456,
      "league": "NBA",
      "country": "USA",
      "season": "NBA 25/26",
      "home_team": "Lakers",
      "away_team": "Celtics",
      "home_score": 98,
      "away_score": 101,
      "score": "98-101",
      "minute": null,
      "status": "Q4",
      "starts_at": "2026-03-13T20:00:00+00:00"
    }
  ]
}
```

### Structured multi-sport fixtures

```bash
curl --request GET \
  --url 'http://localhost:4000/api/fixtures?sport=basketball' \
  --header 'x-api-key: sport_live_demo_free_2026_local'
```

## Verification

Commands run during implementation:

- `npm run build` in `apps/api`
- `npm run build` in `apps/web`
- `python -m py_compile main.py` in `apps/worker`
- Live scraper smoke tests against the SofaScore JSON endpoints using the browser fallback path

Live validation commands:

```bash
curl --request GET --url http://localhost:4000/health
curl --request GET --url http://localhost:4000/api/sports --header 'x-api-key: sport_live_demo_free_2026_local'
curl --request GET --url 'http://localhost:4000/api/fixtures/live?sport=football' --header 'x-api-key: sport_live_demo_free_2026_local'
curl --request GET --url 'http://localhost:4000/api/fixtures/live?sport=esports' --header 'x-api-key: sport_live_demo_free_2026_local'
```

## Notes

- The direct `httpx` request path is implemented as required, but SofaScore still returns `403 Forbidden` from this environment. The worker escalates to a verified Playwright navigation fallback after blocked direct attempts.
- The worker snapshot is what allows the demo API to expose a full live match list even when the local API and worker are not sharing a real PostgreSQL instance.
- The Playwright-based worker image uses Microsoft's Playwright Python base image so Chromium is available inside Docker.

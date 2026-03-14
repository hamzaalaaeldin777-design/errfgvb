import { supportedSports } from "@/lib/sports-catalog";

export type ImplementedEndpoint = {
  method: "GET" | "POST";
  path: string;
  description: string;
  params: string;
  response: string;
};

export type ReferenceRoute = {
  path: string;
  summary: string;
  filters: string;
};

export type ReferenceGroup = {
  title: string;
  description: string;
  routes: ReferenceRoute[];
};

export const docsSources = [
  {
    label: "API-Football v3",
    href: "https://www.api-football.com/documentation-v3",
  },
  {
    label: "API-Football docs",
    href: "https://www.api-football.com/documentation",
  },
];

export const authChecks = [
  {
    title: "Health probe",
    command: `curl --request GET \\
  --url http://localhost:4000/health`,
    detail: "Returns service status, timestamp, and the current live snapshot metadata if the worker is running.",
  },
  {
    title: "Live board",
    command: `curl --request GET \\
  --url http://localhost:4000/api/fixtures/live?sport=basketball \\
  --header 'x-api-key: sport_live_demo_free_2026_local'`,
    detail: "Returns the current live fixture board from the worker snapshot, filtered to a single sport if needed. Counts can still be large because the scraper includes reserve, cup, and lower-tier matches too.",
  },
  {
    title: "Dashboard auth",
    command: `curl --request POST \\
  --url http://localhost:4000/auth/login \\
  --header 'Content-Type: application/json' \\
  --data '{"email":"demo@sportstack.dev","password":"Demo123!"}'`,
    detail: "Returns a JWT for the developer dashboard. Public data endpoints keep using API keys, not the JWT.",
  },
];

export const platformNotes = [
  "Public REST endpoints require x-api-key. Dashboard and admin routes use JWT bearer tokens.",
  "Every supported sport now flows through the same structured API surface: leagues, teams, players, fixtures, live fixtures, and standings.",
  "The worker refreshes a multi-sport catalog, throttles upstream requests to at most one every 3 seconds, and writes a shared snapshot consumed by the API while also syncing PostgreSQL when available.",
  "Response headers include x-ratelimit-limit and x-ratelimit-remaining for metered plans.",
];

export const coverageNotes = [
  "All listed sports now expose the same core endpoints for leagues, teams, players, fixtures, live fixtures, and standings.",
  "Structured responses are assembled from the worker snapshot in local demo mode and from PostgreSQL in production when the worker is connected to a real database.",
  "Some upstream competitions still return sparse fields, so empty standings or short player lists can happen for event formats where SofaScore does not expose a richer table or roster.",
];

export const multiSportCatalog = supportedSports;

export const rateLimitPlans = [
  ["Free", "100 requests/day"],
  ["Pro", "10,000 requests/day"],
  ["Enterprise", "Unlimited"],
] as const;

export const implementedEndpoints: ImplementedEndpoint[] = [
  {
    method: "GET",
    path: "/api/sports",
    description: "List supported sports, current live counts, and which ones have full structured coverage.",
    params: "None",
    response: `{
  "success": true,
  "count": 25,
  "data": [
    {
      "slug": "football",
      "name": "Football",
      "live_count": 48,
      "updated_at": "2026-03-14T00:12:00+00:00",
      "coverage": ["live", "leagues", "teams", "players", "fixtures", "standings"]
    },
    {
      "slug": "basketball",
      "name": "Basketball",
      "live_count": 15,
      "updated_at": "2026-03-14T00:12:08+00:00",
      "coverage": ["live", "leagues", "teams", "players", "fixtures", "standings"]
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/leagues",
    description: "List structured competitions currently available across the supported sports catalog.",
    params: "sport, search",
    response: `{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "sport_slug": "football",
      "sport_name": "Football",
      "name": "Premier League",
      "country": "England",
      "season": "2025-2026",
      "logo_url": "https://media.api-sports.io/football/leagues/39.png"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/teams?league_id=1&sport=football&search=liver",
    description: "Search teams by league, sport, or team name.",
    params: "league_id, sport, search",
    response: `{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "name": "Liverpool",
      "short_name": "LIV",
      "country": "England",
      "founded": 1892,
      "venue": "Anfield",
      "league": "Premier League",
      "sport_slug": "football",
      "sport_name": "Football"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/players?team_id=1&sport=football",
    description: "Return players for a club or search across player names for every supported sport.",
    params: "team_id, sport, search",
    response: `{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "name": "Mohamed Salah",
      "position": "Forward",
      "age": 33,
      "nationality": "Egypt",
      "team": "Liverpool",
      "sport_slug": "football",
      "sport_name": "Football"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/fixtures?league_id=1&sport=football&date=2026-03-13",
    description: "List structured fixtures with league, sport, teams, scoreline, status, and kickoff timestamp.",
    params: "league_id, sport, team_id, date",
    response: `{
  "success": true,
  "count": 2,
  "data": [
    {
      "match_id": 1001,
      "sport_slug": "football",
      "sport_name": "Football",
      "league": "Premier League",
      "country": "England",
      "season": "2025-2026",
      "home_team": "Liverpool",
      "away_team": "Chelsea",
      "home_score": 2,
      "away_score": 1,
      "score": "2-1",
      "minute": 67,
      "status": "2H",
      "starts_at": "2026-03-13T19:00:00.000Z",
      "venue": "Anfield"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/fixtures/live?sport=basketball&limit=20",
    description: "Return the current live multi-sport board from the worker snapshot, filtered by sport or search text when needed.",
    params: "sport, search, limit",
    response: `{
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
}`,
  },
  {
    method: "GET",
    path: "/api/standings?league_id=1&sport=football",
    description: "Return table rows ordered by position for a competition when the upstream tournament exposes standings data.",
    params: "league_id, sport",
    response: `{
  "success": true,
  "count": 4,
  "data": [
    {
      "sport_slug": "football",
      "sport_name": "Football",
      "position": 1,
      "team": "Arsenal",
      "played": 28,
      "wins": 21,
      "draws": 4,
      "losses": 3,
      "goals_for": 63,
      "goals_against": 24,
      "points": 67,
      "form": "WWDWW",
      "league": "Premier League"
    }
  ]
}`,
  },
];

export const officialReferenceGroups: ReferenceGroup[] = [
  {
    title: "Discovery",
    description: "Competition metadata and lookup routes used to build selectors, caches, and sync plans.",
    routes: [
      { path: "/timezone", summary: "List supported time zones for fixture and date queries.", filters: "None" },
      { path: "/countries", summary: "Discover countries and ISO-style codes available in the data set.", filters: "name, code, search" },
      { path: "/leagues", summary: "Search leagues and cups by id, country, season, team membership, and current state.", filters: "id, name, country, code, season, team, type, current, search, last" },
      { path: "/leagues/seasons", summary: "Return the season keys available across competitions.", filters: "None" },
      { path: "/venues", summary: "Search stadiums and venue metadata.", filters: "id, name, city, country, search" },
    ],
  },
  {
    title: "Teams",
    description: "Club discovery and season-specific team context.",
    routes: [
      { path: "/teams", summary: "Fetch team profiles by id, name, country, league, venue, or season.", filters: "id, name, league, season, country, code, venue, search" },
      { path: "/teams/statistics", summary: "Return season-level club performance splits and trends.", filters: "league, season, team, date" },
      { path: "/teams/seasons", summary: "List the seasons available for a team.", filters: "team" },
      { path: "/teams/countries", summary: "Return countries that currently have team coverage.", filters: "None" },
    ],
  },
  {
    title: "Fixtures",
    description: "The largest route family in the official model, covering schedules, live boards, match detail, and head-to-head lookups.",
    routes: [
      { path: "/standings", summary: "Return table standings for a league and season, optionally narrowed to a team.", filters: "league, season, team" },
      { path: "/fixtures/rounds", summary: "List rounds for a competition and season.", filters: "league, season, current, dates, timezone" },
      { path: "/fixtures", summary: "Main fixture feed for ids, live matches, date windows, league filters, team filters, rounds, and statuses.", filters: "id, ids, live, date, league, season, team, last, next, from, to, round, status, venue, timezone" },
      { path: "/fixtures/headtohead", summary: "Compare fixtures between two teams using an h2h pair key.", filters: "h2h, date, league, season, last, next, from, to, status, venue, timezone" },
      { path: "/fixtures/statistics", summary: "Return team-level match statistics for a fixture.", filters: "fixture, team, type, half" },
      { path: "/fixtures/events", summary: "Return cards, goals, substitutions, and other event entries for a fixture.", filters: "fixture, team, player, type" },
      { path: "/fixtures/lineups", summary: "Return lineups, formations, and starting XI data.", filters: "fixture, team, player, type" },
      { path: "/fixtures/players", summary: "Return player-level statistics for a specific fixture.", filters: "fixture, team" },
      { path: "/injuries", summary: "Track injury availability by league, fixture, team, player, or date.", filters: "league, season, fixture, team, player, date, ids, timezone" },
      { path: "/predictions", summary: "Return a prediction object for a fixture.", filters: "fixture" },
    ],
  },
  {
    title: "Players And Staff",
    description: "Player catalogs, season history, squad views, rankings, and coach records.",
    routes: [
      { path: "/coachs", summary: "Return coach profiles by coach id, team, or search term.", filters: "id, team, search" },
      { path: "/players/seasons", summary: "List seasons available for a player.", filters: "player" },
      { path: "/players/profiles", summary: "Return player profile cards with pagination.", filters: "player, search, page" },
      { path: "/players", summary: "Return player statistics filtered by player id, team, league, season, or search term.", filters: "id, team, league, season, search, page" },
      { path: "/players/squads", summary: "Return squad membership for a team, optionally focusing on one player.", filters: "team, player" },
      { path: "/players/teams", summary: "Return the clubs and seasons associated with a player.", filters: "player" },
      { path: "/players/topscorers", summary: "Return top scorers for a league season.", filters: "league, season" },
      { path: "/players/topassists", summary: "Return top assist leaders for a league season.", filters: "league, season" },
      { path: "/players/topyellowcards", summary: "Return players with the most yellow cards in a league season.", filters: "league, season" },
      { path: "/players/topredcards", summary: "Return players with the most red cards in a league season.", filters: "league, season" },
    ],
  },
  {
    title: "History And Availability",
    description: "Longer-lived profile data used in player pages and scouting views.",
    routes: [
      { path: "/transfers", summary: "Return transfer history for a player or team.", filters: "player, team" },
      { path: "/trophies", summary: "Return trophy history for players and coaches.", filters: "player, players, coach, coachs" },
      { path: "/sidelined", summary: "Return suspension and sidelined history for players and coaches.", filters: "player, players, coach, coachs" },
    ],
  },
  {
    title: "Odds",
    description: "Pre-match and in-play betting routes, bookmakers, bet mappings, and lookup helpers.",
    routes: [
      { path: "/odds/live", summary: "Return live in-play odds by fixture or league.", filters: "fixture, league, bet" },
      { path: "/odds/live/bets", summary: "Return the bet catalog for live odds.", filters: "id, search" },
      { path: "/odds", summary: "Return pre-match odds by fixture, league, season, date, bookmaker, bet, and page.", filters: "fixture, league, season, date, timezone, page, bookmaker, bet" },
      { path: "/odds/mapping", summary: "Return the bookmaker-to-bet mapping catalog.", filters: "page" },
      { path: "/odds/bookmakers", summary: "Return bookmaker reference data.", filters: "id, search" },
      { path: "/odds/bets", summary: "Return bet reference data.", filters: "id, search" },
    ],
  },
];

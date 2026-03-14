import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/postgres";
import { loadLiveSnapshot, loadLiveSnapshotSports } from "../lib/liveSnapshot";
import { sendCollection } from "../lib/responses";
import { requireApiKey } from "../middleware/apiKey";

const queryIdSchema = z.object({
  league_id: z.coerce.number().optional(),
  team_id: z.coerce.number().optional(),
  date: z.string().optional(),
  search: z.string().optional(),
  sport: z.string().trim().toLowerCase().optional(),
  limit: z.coerce.number().int().positive().max(250).optional(),
});

export const publicApiRouter = Router();

publicApiRouter.use(requireApiKey);

function getCoverageForSport(_slug: string) {
  return ["live", "leagues", "teams", "players", "fixtures", "standings"];
}

function matchesSearch(value: string, search: string | undefined) {
  if (!search) {
    return true;
  }

  return value.toLowerCase().includes(search.toLowerCase());
}

function mergeRows<T>(
  dbRows: T[],
  snapshotRows: T[],
  getKey: (row: T) => string,
) {
  const rows = new Map<string, T>();

  for (const row of dbRows) {
    rows.set(getKey(row), row);
  }

  for (const row of snapshotRows) {
    rows.set(getKey(row), row);
  }

  return Array.from(rows.values());
}

publicApiRouter.get("/sports", async (_req, res) => {
  const [liveSnapshotSports, dbSportsResult] = await Promise.all([
    loadLiveSnapshotSports(),
    pool.query(
      `
        select distinct sport_slug, sport_name
        from leagues
        order by sport_name asc
      `,
    ),
  ]);

  const sports = new Map<
    string,
    {
      slug: string;
      name: string;
      live_count: number;
      updated_at: string | null;
      coverage: string[];
    }
  >();

  for (const sport of liveSnapshotSports ?? []) {
    sports.set(sport.slug, {
      slug: sport.slug,
      name: sport.name,
      live_count: sport.live_count,
      updated_at: sport.updated_at ?? null,
      coverage: getCoverageForSport(sport.slug),
    });
  }

  for (const row of dbSportsResult.rows as Array<{
    sport_slug: string;
    sport_name: string;
  }>) {
    if (!sports.has(row.sport_slug)) {
      sports.set(row.sport_slug, {
        slug: row.sport_slug,
        name: row.sport_name,
        live_count: 0,
        updated_at: null,
        coverage: getCoverageForSport(row.sport_slug),
      });
    }
  }

  return sendCollection(res, Array.from(sports.values()));
});

publicApiRouter.get("/leagues", async (req, res) => {
  const parsed = queryIdSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid leagues query parameters." });
  }

  const filters: string[] = [];
  const values: Array<number | string> = [];

  if (parsed.data.sport) {
    values.push(parsed.data.sport);
    filters.push(`sport_slug = $${values.length}`);
  }

  if (parsed.data.search) {
    values.push(`%${parsed.data.search}%`);
    filters.push(`name ilike $${values.length}`);
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";
  const [liveSnapshot, result] = await Promise.all([
    loadLiveSnapshot(),
    pool.query(
      `
        select id, sport_slug, sport_name, name, country, season, logo_url
        from leagues
        ${whereClause}
        order by name asc
      `,
      values,
    ),
  ]);

  const snapshotRows = (liveSnapshot?.leagues ?? [])
    .filter((league) =>
      parsed.data.sport ? league.sport_slug === parsed.data.sport : true,
    )
    .filter((league) => matchesSearch(league.name, parsed.data.search))
    .map((league) => ({
      id: league.id,
      sport_slug: league.sport_slug,
      sport_name: league.sport_name,
      name: league.name,
      country: league.country ?? null,
      season: league.season,
      logo_url: league.logo_url ?? null,
    }));

  const rows = mergeRows(
    result.rows,
    snapshotRows,
    (row) =>
      `${(row as { sport_slug: string }).sport_slug}:${(row as { name: string }).name}:${(row as { season: string }).season}:${(row as { country: string | null }).country ?? ""}`,
  ).sort((left, right) =>
    (left as { name: string }).name.localeCompare((right as { name: string }).name),
  );

  return sendCollection(res, rows);
});

publicApiRouter.get("/teams", async (req, res) => {
  const parsed = queryIdSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid teams query parameters." });
  }

  const filters: string[] = [];
  const values: Array<number | string> = [];

  if (parsed.data.league_id) {
    values.push(parsed.data.league_id);
    filters.push(`t.league_id = $${values.length}`);
  }

  if (parsed.data.sport) {
    values.push(parsed.data.sport);
    filters.push(`l.sport_slug = $${values.length}`);
  }

  if (parsed.data.search) {
    values.push(`%${parsed.data.search}%`);
    filters.push(`t.name ilike $${values.length}`);
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";
  const [liveSnapshot, result] = await Promise.all([
    loadLiveSnapshot(),
    pool.query(
      `
        select
          t.id,
          t.name,
          t.short_name,
          t.country,
          t.founded,
          t.venue,
          t.logo_url,
          l.name as league,
          l.sport_slug,
          l.sport_name
        from teams t
        left join leagues l on l.id = t.league_id
        ${whereClause}
        order by t.name asc
      `,
      values,
    ),
  ]);

  const snapshotRows = (liveSnapshot?.teams ?? [])
    .filter((team) =>
      parsed.data.league_id ? team.league_id === parsed.data.league_id : true,
    )
    .filter((team) =>
      parsed.data.sport ? team.sport_slug === parsed.data.sport : true,
    )
    .filter((team) => matchesSearch(team.name, parsed.data.search))
    .map((team) => ({
      id: team.id,
      name: team.name,
      short_name: team.short_name ?? null,
      country: team.country ?? null,
      founded: team.founded ?? null,
      venue: team.venue ?? null,
      logo_url: team.logo_url ?? null,
      league: team.league ?? null,
      sport_slug: team.sport_slug,
      sport_name: team.sport_name,
    }));

  const rows = mergeRows(
    result.rows,
    snapshotRows,
    (row) =>
      `${(row as { sport_slug: string }).sport_slug}:${(row as { name: string }).name}:${(row as { league: string | null }).league ?? ""}`,
  ).sort((left, right) =>
    (left as { name: string }).name.localeCompare((right as { name: string }).name),
  );

  return sendCollection(res, rows);
});

publicApiRouter.get("/players", async (req, res) => {
  const parsed = queryIdSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid players query parameters." });
  }

  const filters: string[] = [];
  const values: Array<number | string> = [];

  if (parsed.data.team_id) {
    values.push(parsed.data.team_id);
    filters.push(`p.team_id = $${values.length}`);
  }

  if (parsed.data.sport) {
    values.push(parsed.data.sport);
    filters.push(`l.sport_slug = $${values.length}`);
  }

  if (parsed.data.search) {
    values.push(`%${parsed.data.search}%`);
    filters.push(`p.name ilike $${values.length}`);
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";
  const [liveSnapshot, result] = await Promise.all([
    loadLiveSnapshot(),
    pool.query(
      `
        select
          p.id,
          p.name,
          p.position,
          p.age,
          p.nationality,
          p.photo_url,
          t.name as team,
          l.sport_slug,
          l.sport_name
        from players p
        left join teams t on t.id = p.team_id
        left join leagues l on l.id = t.league_id
        ${whereClause}
        order by p.name asc
      `,
      values,
    ),
  ]);

  const snapshotRows = (liveSnapshot?.players ?? [])
    .filter((player) =>
      parsed.data.team_id ? player.team_id === parsed.data.team_id : true,
    )
    .filter((player) =>
      parsed.data.sport ? player.sport_slug === parsed.data.sport : true,
    )
    .filter((player) => matchesSearch(player.name, parsed.data.search))
    .map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position ?? null,
      age: player.age ?? null,
      nationality: player.nationality ?? null,
      photo_url: player.photo_url ?? null,
      team: player.team ?? null,
      sport_slug: player.sport_slug,
      sport_name: player.sport_name,
    }));

  const rows = mergeRows(
    result.rows,
    snapshotRows,
    (row) =>
      `${(row as { sport_slug: string }).sport_slug}:${(row as { name: string }).name}:${(row as { team: string | null }).team ?? ""}`,
  ).sort((left, right) =>
    (left as { name: string }).name.localeCompare((right as { name: string }).name),
  );

  return sendCollection(res, rows);
});

publicApiRouter.get("/fixtures", async (req, res) => {
  const parsed = queryIdSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid fixtures query parameters." });
  }

  const filters: string[] = [];
  const values: Array<number | string> = [];

  if (parsed.data.league_id) {
    values.push(parsed.data.league_id);
    filters.push(`f.league_id = $${values.length}`);
  }

  if (parsed.data.sport) {
    values.push(parsed.data.sport);
    filters.push(`l.sport_slug = $${values.length}`);
  }

  if (parsed.data.team_id) {
    values.push(parsed.data.team_id);
    filters.push(
      `(f.home_team_id = $${values.length} or f.away_team_id = $${values.length})`,
    );
  }

  if (parsed.data.date) {
    values.push(parsed.data.date);
    filters.push(`f.starts_at::date = $${values.length}::date`);
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";
  const [liveSnapshot, result] = await Promise.all([
    loadLiveSnapshot(),
    pool.query(
      `
        select
          f.id as match_id,
          l.sport_slug,
          l.sport_name,
          l.name as league,
          l.country,
          l.season,
          home.name as home_team,
          away.name as away_team,
          f.home_score,
          f.away_score,
          f.home_score::text || '-' || f.away_score::text as score,
          f.minute,
          f.status,
          f.starts_at,
          f.venue
        from fixtures f
        join leagues l on l.id = f.league_id
        join teams home on home.id = f.home_team_id
        join teams away on away.id = f.away_team_id
        ${whereClause}
        order by f.starts_at desc
      `,
      values,
    ),
  ]);

  const snapshotRows = (liveSnapshot?.fixtures ?? [])
    .filter((fixture) =>
      parsed.data.league_id ? fixture.league_id === parsed.data.league_id : true,
    )
    .filter((fixture) =>
      parsed.data.sport ? fixture.sport_slug === parsed.data.sport : true,
    )
    .filter((fixture) =>
      parsed.data.team_id
        ? fixture.home_team_id === parsed.data.team_id ||
          fixture.away_team_id === parsed.data.team_id
        : true,
    )
    .filter((fixture) =>
      parsed.data.date
        ? fixture.starts_at?.slice(0, 10) === parsed.data.date
        : true,
    )
    .map((fixture) => ({
      match_id: fixture.match_id,
      sport_slug: fixture.sport_slug,
      sport_name: fixture.sport_name,
      league: fixture.league,
      country: fixture.country ?? null,
      season: fixture.season ?? null,
      home_team: fixture.home_team,
      away_team: fixture.away_team,
      home_score: fixture.home_score,
      away_score: fixture.away_score,
      score: fixture.score,
      minute: fixture.minute,
      status: fixture.status,
      starts_at: fixture.starts_at ?? null,
      venue: fixture.venue ?? null,
    }));

  const rows = mergeRows(
    result.rows,
    snapshotRows,
    (row) =>
      `${(row as { sport_slug: string }).sport_slug}:${(row as { match_id: number }).match_id}`,
  ).sort((left, right) =>
    String((right as { starts_at: string | null }).starts_at ?? "").localeCompare(
      String((left as { starts_at: string | null }).starts_at ?? ""),
    ),
  );

  return sendCollection(res, rows);
});

publicApiRouter.get("/fixtures/live", async (req, res) => {
  const parsed = queryIdSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid live fixtures query parameters." });
  }

  const liveSnapshot = await loadLiveSnapshot();

  if (liveSnapshot !== null) {
    const filteredMatches = liveSnapshot.matches
      .filter((match) =>
        parsed.data.sport ? match.sport_slug === parsed.data.sport : true,
      )
      .filter((match) =>
        parsed.data.search
          ? [match.league, match.home_team, match.away_team]
              .join(" ")
              .toLowerCase()
              .includes(parsed.data.search.toLowerCase())
          : true,
      );

    return sendCollection(
      res,
      parsed.data.limit
        ? filteredMatches.slice(0, parsed.data.limit)
        : filteredMatches,
    );
  }

  const filters: string[] = [`f.status in ('1H', 'HT', '2H', 'LIVE')`];
  const values: Array<number | string> = [];

  if (parsed.data.sport) {
    values.push(parsed.data.sport);
    filters.push(`l.sport_slug = $${values.length}`);
  }

  const whereClause = `where ${filters.join(" and ")}`;

  const result = await pool.query(
    `
      select
        f.id as match_id,
        l.sport_slug,
        l.sport_name,
        l.name as league,
        l.country,
        l.season,
        home.name as home_team,
        away.name as away_team,
        f.home_score,
        f.away_score,
        f.home_score::text || '-' || f.away_score::text as score,
        f.minute,
        f.status,
        f.starts_at
      from fixtures f
      join leagues l on l.id = f.league_id
      join teams home on home.id = f.home_team_id
      join teams away on away.id = f.away_team_id
      ${whereClause}
      order by f.starts_at asc
    `,
    values,
  );

  return sendCollection(res, result.rows);
});

publicApiRouter.get("/standings", async (req, res) => {
  const parsed = queryIdSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid standings query parameters." });
  }

  const values: Array<number | string> = [];
  const filters: string[] = [];

  if (parsed.data.league_id) {
    values.push(parsed.data.league_id);
    filters.push(`s.league_id = $${values.length}`);
  }

  if (parsed.data.sport) {
    values.push(parsed.data.sport);
    filters.push(`l.sport_slug = $${values.length}`);
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";

  const [liveSnapshot, result] = await Promise.all([
    loadLiveSnapshot(),
    pool.query(
      `
        select
          l.sport_slug,
          l.sport_name,
          s.position,
          t.name as team,
          s.played,
          s.wins,
          s.draws,
          s.losses,
          s.goals_for,
          s.goals_against,
          s.points,
          s.form,
          l.name as league
        from standings s
        join teams t on t.id = s.team_id
        join leagues l on l.id = s.league_id
        ${whereClause}
        order by l.name asc, s.position asc
      `,
      values,
    ),
  ]);

  const snapshotRows = (liveSnapshot?.standings ?? [])
    .filter((standing) =>
      parsed.data.league_id ? standing.league_id === parsed.data.league_id : true,
    )
    .filter((standing) =>
      parsed.data.sport ? standing.sport_slug === parsed.data.sport : true,
    )
    .map((standing) => ({
      sport_slug: standing.sport_slug,
      sport_name: standing.sport_name,
      position: standing.position,
      team: standing.team,
      played: standing.played,
      wins: standing.wins,
      draws: standing.draws,
      losses: standing.losses,
      goals_for: standing.goals_for,
      goals_against: standing.goals_against,
      points: standing.points,
      form: standing.form ?? "",
      league: standing.league,
    }));

  const rows = mergeRows(
    result.rows,
    snapshotRows,
    (row) =>
      `${(row as { sport_slug: string }).sport_slug}:${(row as { league: string }).league}:${(row as { team: string }).team}:${(row as { position: number }).position}`,
  ).sort((left, right) => {
    const leagueCompare = (left as { league: string }).league.localeCompare(
      (right as { league: string }).league,
    );

    if (leagueCompare !== 0) {
      return leagueCompare;
    }

    return (left as { position: number }).position -
      (right as { position: number }).position;
  });

  return sendCollection(res, rows);
});

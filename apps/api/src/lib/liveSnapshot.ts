import { readFile } from "node:fs/promises";
import { z } from "zod";
import { env } from "../config/env";

const liveSnapshotSportSchema = z.object({
  slug: z.string(),
  name: z.string(),
  live_count: z.number(),
  updated_at: z.string().nullable().optional(),
  endpoint: z.string().optional(),
});

const liveSnapshotMatchSchema = z.object({
  sport_slug: z.string(),
  sport_name: z.string(),
  match_id: z.number(),
  league: z.string(),
  country: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
  home_team: z.string(),
  away_team: z.string(),
  home_score: z.number(),
  away_score: z.number(),
  score: z.string(),
  minute: z.number().nullable(),
  status: z.string(),
  starts_at: z.string().nullable().optional(),
});

const liveSnapshotLeagueSchema = z.object({
  id: z.number(),
  source_id: z.string(),
  sport_slug: z.string(),
  sport_name: z.string(),
  name: z.string(),
  country: z.string().nullable().optional(),
  season: z.string(),
  logo_url: z.string().nullable().optional(),
});

const liveSnapshotTeamSchema = z.object({
  id: z.number(),
  source_id: z.string(),
  league_id: z.number().nullable().optional(),
  league_source_id: z.string().nullable().optional(),
  name: z.string(),
  short_name: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  founded: z.number().nullable().optional(),
  venue: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  league: z.string().nullable().optional(),
  sport_slug: z.string(),
  sport_name: z.string(),
});

const liveSnapshotPlayerSchema = z.object({
  id: z.number(),
  source_id: z.string(),
  team_id: z.number().nullable().optional(),
  team_source_id: z.string().nullable().optional(),
  name: z.string(),
  position: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  nationality: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  sport_slug: z.string(),
  sport_name: z.string(),
});

const liveSnapshotFixtureSchema = z.object({
  match_id: z.number(),
  source_id: z.string(),
  league_id: z.number().nullable().optional(),
  league_source_id: z.string().nullable().optional(),
  sport_slug: z.string(),
  sport_name: z.string(),
  league: z.string(),
  country: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
  home_team_id: z.number().nullable().optional(),
  home_team_source_id: z.string().nullable().optional(),
  away_team_id: z.number().nullable().optional(),
  away_team_source_id: z.string().nullable().optional(),
  home_team: z.string(),
  away_team: z.string(),
  home_score: z.number(),
  away_score: z.number(),
  score: z.string(),
  minute: z.number().nullable(),
  status: z.string(),
  starts_at: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
});

const liveSnapshotStandingSchema = z.object({
  league_id: z.number(),
  league_source_id: z.string().nullable().optional(),
  team_id: z.number().nullable().optional(),
  team_source_id: z.string().nullable().optional(),
  sport_slug: z.string(),
  sport_name: z.string(),
  position: z.number(),
  team: z.string(),
  played: z.number(),
  wins: z.number(),
  draws: z.number(),
  losses: z.number(),
  goals_for: z.number(),
  goals_against: z.number(),
  points: z.number(),
  form: z.string().nullable().optional(),
  league: z.string(),
});

const liveSnapshotCommentSchema = z.object({
  source_id: z.string(),
  fixture_id: z.number(),
  sport_slug: z.string(),
  sport_name: z.string(),
  league: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  is_live: z.boolean(),
  sequence: z.number(),
  minute: z.number().nullable().optional(),
  type: z.string(),
  text: z.string(),
  is_home: z.boolean().nullable().optional(),
  player: z.string().nullable().optional(),
});

const liveSnapshotVideoSchema = z.object({
  source_id: z.string(),
  fixture_id: z.number(),
  sport_slug: z.string(),
  sport_name: z.string(),
  league: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  media_type: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  is_highlight: z.boolean(),
});

const liveSnapshotOddsChoiceSchema = z.object({
  name: z.string(),
  fractional_value: z.string().nullable().optional(),
  decimal_value: z.number().nullable().optional(),
  probability: z.number().nullable().optional(),
  winning: z.boolean().nullable().optional(),
});

const liveSnapshotOddsSchema = z.object({
  source_id: z.string(),
  fixture_id: z.number(),
  sport_slug: z.string(),
  sport_name: z.string(),
  league: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  market_id: z.number().nullable().optional(),
  market_name: z.string(),
  market_group: z.string().nullable().optional(),
  market_period: z.string().nullable().optional(),
  is_live: z.boolean(),
  suspended: z.boolean(),
  source: z.string(),
  choices: z.array(liveSnapshotOddsChoiceSchema).default([]),
});

const liveSnapshotProbabilitySchema = z.object({
  source_id: z.string(),
  fixture_id: z.number(),
  sport_slug: z.string(),
  sport_name: z.string(),
  league: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  market: z.string(),
  source: z.string(),
  home_probability: z.number().nullable().optional(),
  draw_probability: z.number().nullable().optional(),
  away_probability: z.number().nullable().optional(),
  updated_at: z.string(),
});

const liveSnapshotSchema = z.object({
  updated_at: z.string(),
  count: z.number(),
  sports: z.array(liveSnapshotSportSchema).default([]),
  matches: z.array(liveSnapshotMatchSchema),
  leagues: z.array(liveSnapshotLeagueSchema).default([]),
  teams: z.array(liveSnapshotTeamSchema).default([]),
  players: z.array(liveSnapshotPlayerSchema).default([]),
  fixtures: z.array(liveSnapshotFixtureSchema).default([]),
  standings: z.array(liveSnapshotStandingSchema).default([]),
  comments: z.array(liveSnapshotCommentSchema).default([]),
  videos: z.array(liveSnapshotVideoSchema).default([]),
  odds: z.array(liveSnapshotOddsSchema).default([]),
  probabilities: z.array(liveSnapshotProbabilitySchema).default([]),
  structured_counts: z
    .object({
      leagues: z.number(),
      teams: z.number(),
      players: z.number(),
      fixtures: z.number(),
      standings: z.number(),
      comments: z.number().optional(),
      videos: z.number().optional(),
      odds: z.number().optional(),
      probabilities: z.number().optional(),
    })
    .optional(),
});

async function readLiveSnapshot() {
  try {
    const snapshotText = await readFile(env.LIVE_SNAPSHOT_PATH, "utf8");
    return liveSnapshotSchema.parse(JSON.parse(snapshotText));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    console.error("Failed to read live snapshot", error);
    return null;
  }
}

export async function loadLiveSnapshot() {
  return readLiveSnapshot();
}

export async function loadLiveSnapshotMatches() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.matches ?? null;
}

export async function loadLiveSnapshotSports() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.sports ?? null;
}

export async function loadLiveSnapshotLeagues() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.leagues ?? null;
}

export async function loadLiveSnapshotTeams() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.teams ?? null;
}

export async function loadLiveSnapshotPlayers() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.players ?? null;
}

export async function loadLiveSnapshotFixtures() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.fixtures ?? null;
}

export async function loadLiveSnapshotStandings() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.standings ?? null;
}

export async function loadLiveSnapshotComments() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.comments ?? null;
}

export async function loadLiveSnapshotVideos() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.videos ?? null;
}

export async function loadLiveSnapshotOdds() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.odds ?? null;
}

export async function loadLiveSnapshotProbabilities() {
  const snapshot = await readLiveSnapshot();
  return snapshot?.probabilities ?? null;
}

export async function loadLiveSnapshotMeta() {
  const snapshot = await readLiveSnapshot();

  if (!snapshot) {
    return null;
  }

  return {
    path: env.LIVE_SNAPSHOT_PATH,
    updated_at: snapshot.updated_at,
    count: snapshot.count,
    sports: snapshot.sports.map((sport) => ({
      slug: sport.slug,
      name: sport.name,
      live_count: sport.live_count,
      updated_at: sport.updated_at ?? null,
    })),
    source: "worker_snapshot",
    structured_counts: snapshot.structured_counts ?? {
      leagues: snapshot.leagues.length,
      teams: snapshot.teams.length,
      players: snapshot.players.length,
      fixtures: snapshot.fixtures.length,
      standings: snapshot.standings.length,
      comments: snapshot.comments.length,
      videos: snapshot.videos.length,
      odds: snapshot.odds.length,
      probabilities: snapshot.probabilities.length,
    },
  };
}

export type LiveSnapshot = NonNullable<Awaited<ReturnType<typeof loadLiveSnapshot>>>;
export type LiveSnapshotMatch = z.infer<typeof liveSnapshotMatchSchema>;
export type LiveSnapshotSport = z.infer<typeof liveSnapshotSportSchema>;
export type LiveSnapshotLeague = z.infer<typeof liveSnapshotLeagueSchema>;
export type LiveSnapshotTeam = z.infer<typeof liveSnapshotTeamSchema>;
export type LiveSnapshotPlayer = z.infer<typeof liveSnapshotPlayerSchema>;
export type LiveSnapshotFixture = z.infer<typeof liveSnapshotFixtureSchema>;
export type LiveSnapshotStanding = z.infer<typeof liveSnapshotStandingSchema>;
export type LiveSnapshotComment = z.infer<typeof liveSnapshotCommentSchema>;
export type LiveSnapshotVideo = z.infer<typeof liveSnapshotVideoSchema>;
export type LiveSnapshotOdds = z.infer<typeof liveSnapshotOddsSchema>;
export type LiveSnapshotProbability = z.infer<typeof liveSnapshotProbabilitySchema>;

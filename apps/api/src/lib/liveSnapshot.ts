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

const liveSnapshotSchema = z.object({
  updated_at: z.string(),
  count: z.number(),
  sports: z.array(liveSnapshotSportSchema).default([]),
  matches: z.array(liveSnapshotMatchSchema),
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
  };
}

export type LiveSnapshot = NonNullable<Awaited<ReturnType<typeof loadLiveSnapshot>>>;
export type LiveSnapshotMatch = z.infer<typeof liveSnapshotMatchSchema>;
export type LiveSnapshotSport = z.infer<typeof liveSnapshotSportSchema>;

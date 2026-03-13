import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const defaultLiveSnapshotPath = path.resolve(
  process.cwd(),
  "../../.codex-runtime/live-matches.json",
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/sportsstack"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("super-secret-development-jwt"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  SPORTS_SOURCE_API_KEY: z.string().default("123"),
  LIVE_SNAPSHOT_PATH: z.string().default(defaultLiveSnapshotPath),
});

export const env = envSchema.parse(process.env);

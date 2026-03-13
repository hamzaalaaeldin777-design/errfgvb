import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/postgres";
import { ensureRedis, redis } from "../db/redis";
import { hashApiKey } from "../lib/apiKeys";
import { getDailyLimit, type PlanName } from "../lib/plans";

function getSecondsUntilTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

async function logUsage(
  apiKeyId: string,
  userId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
) {
  await pool.query(
    `
      insert into api_requests (api_key_id, user_id, endpoint, method, status_code, response_time_ms)
      values ($1, $2, $3, $4, $5, $6)
    `,
    [apiKeyId, userId, endpoint, method, statusCode, responseTimeMs],
  );

  await pool.query(
    `
      update api_keys
      set last_used_at = now(), updated_at = now()
      where id = $1
    `,
    [apiKeyId],
  );
}

export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const rawApiKey = req.header("x-api-key");

  if (!rawApiKey) {
    return res.status(401).json({ error: "Missing x-api-key header." });
  }

  const keyHash = hashApiKey(rawApiKey);
  const result = await pool.query(
    `
      select
        ak.id,
        ak.user_id,
        ak.revoked_at,
        ak.disabled_at,
        u.plan,
        u.status
      from api_keys ak
      join users u on u.id = ak.user_id
      where ak.key_hash = $1
    `,
    [keyHash],
  );

  const apiKey = result.rows[0] as
    | {
        id: string;
        user_id: string;
        revoked_at: string | null;
        disabled_at: string | null;
        plan: PlanName;
        status: string;
      }
    | undefined;

  if (!apiKey) {
    return res.status(401).json({ error: "Invalid API key." });
  }

  if (apiKey.revoked_at || apiKey.disabled_at || apiKey.status !== "active") {
    return res.status(403).json({ error: "API key is not active." });
  }

  await ensureRedis();

  const limit = getDailyLimit(apiKey.plan);
  let usageCount = 0;

  if (limit !== null) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const redisKey = `rate-limit:${apiKey.id}:${dateKey}`;
    usageCount = await redis.incr(redisKey);

    if (usageCount === 1) {
      await redis.expire(redisKey, getSecondsUntilTomorrow());
    }

    if (usageCount > limit) {
      await logUsage(
        apiKey.id,
        apiKey.user_id,
        req.originalUrl,
        req.method,
        429,
        0,
      );

      return res.status(429).json({
        error: "Daily request limit exceeded for this plan.",
        plan: apiKey.plan,
        limit,
      });
    }

    res.setHeader("x-ratelimit-limit", limit.toString());
    res.setHeader(
      "x-ratelimit-remaining",
      Math.max(limit - usageCount, 0).toString(),
    );
  }

  req.apiKeyContext = {
    id: apiKey.id,
    userId: apiKey.user_id,
    plan: apiKey.plan,
  };

  const start = Date.now();
  res.on("finish", () => {
    const responseTimeMs = Date.now() - start;

    logUsage(
      apiKey.id,
      apiKey.user_id,
      req.route?.path ? `${req.baseUrl}${req.route.path}` : req.originalUrl,
      req.method,
      res.statusCode,
      responseTimeMs,
    ).catch((error) => {
      console.error("Failed to log API usage", error);
    });
  });

  return next();
}


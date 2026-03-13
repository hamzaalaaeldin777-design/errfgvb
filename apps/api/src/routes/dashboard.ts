import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/postgres";
import { generateApiKey, getKeyPrefix, hashApiKey } from "../lib/apiKeys";
import { getDailyLimit, PLAN_METADATA } from "../lib/plans";
import { requireAuth } from "../middleware/auth";

const createKeySchema = z.object({
  name: z.string().min(2).max(60),
});

const updatePlanSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]),
});

async function getTodayRequestCount(userId: string) {
  const result = await pool.query(
    `
      select count(*)::int as total
      from api_requests
      where user_id = $1 and created_at::date = current_date
    `,
    [userId],
  );

  return result.rows[0]?.total ?? 0;
}

function buildDailySeries(rows: Array<{ created_at: string | Date }>) {
  const dailyMap = new Map<string, number>();
  const now = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }

  for (const row of rows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
  }

  return Array.from(dailyMap.entries()).map(([day, total]) => ({ day, total }));
}

async function buildOverview(userId: string) {
  const [userResult, keysResult, todayResult, sevenDaysResult, endpointsResult] =
    await Promise.all([
      pool.query(
        `select id, name, email, company, role, plan from users where id = $1`,
        [userId],
      ),
      pool.query(
        `
          select
            id,
            name,
            key_prefix,
            last_used_at,
            created_at,
            revoked_at,
            disabled_at
          from api_keys
          where user_id = $1
          order by created_at desc
        `,
        [userId],
      ),
      pool.query(
        `
          select count(*)::int as total
          from api_requests
          where user_id = $1 and created_at::date = current_date
        `,
        [userId],
      ),
      pool.query(
        `
          select created_at
          from api_requests
          where user_id = $1 and created_at >= now() - interval '6 days'
          order by created_at asc
        `,
        [userId],
      ),
      pool.query(
        `
          select endpoint, count(*)::int as total
          from api_requests
          where user_id = $1 and created_at >= now() - interval '24 hours'
          group by endpoint
          order by total desc
          limit 5
        `,
        [userId],
      ),
    ]);

  const user = userResult.rows[0];
  const today = todayResult.rows[0]?.total ?? 0;
  const limit = getDailyLimit(user.plan);
  const daily = buildDailySeries(
    sevenDaysResult.rows as Array<{ created_at: string | Date }>,
  );

  return {
    user,
    plan: PLAN_METADATA[user.plan as keyof typeof PLAN_METADATA],
    usage: {
      today,
      limit,
      remaining: limit === null ? null : Math.max(limit - today, 0),
      sevenDayTotal: daily.reduce((total, row) => total + row.total, 0),
      daily,
      topEndpoints: endpointsResult.rows,
    },
    keys: keysResult.rows.map((key: Record<string, unknown>) => ({
      id: key.id,
      name: key.name,
      prefix: key.key_prefix,
      lastUsedAt: key.last_used_at,
      createdAt: key.created_at,
      status: key.disabled_at
        ? "disabled"
        : key.revoked_at
          ? "revoked"
          : "active",
    })),
  };
}

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/overview", async (req, res) => {
  const overview = await buildOverview(req.authUser!.id);
  return res.json(overview);
});

dashboardRouter.get("/keys", async (req, res) => {
  const result = await pool.query(
    `
      select
        ak.id,
        ak.name,
        ak.key_prefix,
        ak.last_used_at,
        ak.created_at,
        ak.revoked_at,
        ak.disabled_at,
        count(ar.id)::int as request_count
      from api_keys ak
      left join api_requests ar on ar.api_key_id = ak.id and ar.created_at::date = current_date
      where ak.user_id = $1
      group by ak.id
      order by ak.created_at desc
    `,
    [req.authUser!.id],
  );

  return res.json({
    keys: result.rows.map((key: Record<string, unknown>) => ({
      id: key.id,
      name: key.name,
      prefix: key.key_prefix,
      requestCount: key.request_count,
      lastUsedAt: key.last_used_at,
      createdAt: key.created_at,
      status: key.disabled_at
        ? "disabled"
        : key.revoked_at
          ? "revoked"
          : "active",
    })),
  });
});

dashboardRouter.post("/keys", async (req, res) => {
  const parsed = createKeySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid API key payload.",
      details: parsed.error.flatten(),
    });
  }

  const apiKey = generateApiKey();
  const keyId = randomUUID();

  await pool.query(
    `
      insert into api_keys (id, user_id, name, key_hash, key_prefix)
      values ($1, $2, $3, $4, $5)
    `,
    [
      keyId,
      req.authUser!.id,
      parsed.data.name,
      hashApiKey(apiKey),
      getKeyPrefix(apiKey),
    ],
  );

  return res.status(201).json({
    id: keyId,
    name: parsed.data.name,
    apiKey,
    prefix: getKeyPrefix(apiKey),
  });
});

dashboardRouter.post("/keys/:id/regenerate", async (req, res) => {
  const keyResult = await pool.query(
    `
      select id, disabled_at
      from api_keys
      where id = $1 and user_id = $2
    `,
    [req.params.id, req.authUser!.id],
  );

  const key = keyResult.rows[0];

  if (!key) {
    return res.status(404).json({ error: "API key not found." });
  }

  if (key.disabled_at) {
    return res
      .status(400)
      .json({ error: "Disabled API keys cannot be regenerated." });
  }

  const apiKey = generateApiKey();

  await pool.query(
    `
      update api_keys
      set
        key_hash = $1,
        key_prefix = $2,
        revoked_at = null,
        updated_at = now()
      where id = $3
    `,
    [hashApiKey(apiKey), getKeyPrefix(apiKey), req.params.id],
  );

  return res.json({
    id: req.params.id,
    apiKey,
    prefix: getKeyPrefix(apiKey),
  });
});

dashboardRouter.post("/keys/:id/revoke", async (req, res) => {
  const result = await pool.query(
    `
      update api_keys
      set revoked_at = now(), updated_at = now()
      where id = $1 and user_id = $2
      returning id
    `,
    [req.params.id, req.authUser!.id],
  );

  if (!result.rowCount) {
    return res.status(404).json({ error: "API key not found." });
  }

  return res.json({ success: true });
});

dashboardRouter.post("/plan", async (req, res) => {
  const parsed = updatePlanSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid plan payload.",
      details: parsed.error.flatten(),
    });
  }

  await pool.query(
    `
      update users
      set plan = $1, updated_at = now()
      where id = $2
    `,
    [parsed.data.plan, req.authUser!.id],
  );

  const today = await getTodayRequestCount(req.authUser!.id);

  return res.json({
    plan: parsed.data.plan,
    metadata: PLAN_METADATA[parsed.data.plan],
    usage: {
      today,
      limit: getDailyLimit(parsed.data.plan),
    },
  });
});

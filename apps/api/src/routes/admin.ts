import { Router } from "express";
import { pool } from "../db/postgres";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/users", async (_req, res) => {
  const [usersResult, keysResult, todayResult] = await Promise.all([
    pool.query(
      `
        select
          id,
          name,
          email,
          company,
          role,
          plan,
          status,
          created_at
        from users
        order by created_at desc
      `,
    ),
    pool.query(
      `
        select
          id,
          user_id,
          name,
          key_prefix,
          created_at,
          last_used_at,
          revoked_at,
          disabled_at
        from api_keys
        order by created_at desc
      `,
    ),
    pool.query(
      `
        select user_id, count(*)::int as request_count
        from api_requests
        where created_at::date = current_date
        group by user_id
      `,
    ),
  ]);

  const keysByUser = new Map<string, typeof keysResult.rows>();
  const requestsByUser = new Map<string, number>();

  for (const row of keysResult.rows) {
    const existing = keysByUser.get(row.user_id) ?? [];
    existing.push(row);
    keysByUser.set(row.user_id, existing);
  }

  for (const row of todayResult.rows) {
    requestsByUser.set(row.user_id, Number(row.request_count));
  }

  return res.json({
    users: usersResult.rows.map((user: Record<string, unknown>) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company,
      role: user.role,
      plan: user.plan,
      status: user.status,
      createdAt: user.created_at,
      requestCountToday: requestsByUser.get(String(user.id)) ?? 0,
      keys:
        keysByUser.get(String(user.id))?.map((key: Record<string, unknown>) => ({
          id: key.id,
          name: key.name,
          prefix: key.key_prefix,
          createdAt: key.created_at,
          lastUsedAt: key.last_used_at,
          status: key.disabled_at
            ? "disabled"
            : key.revoked_at
              ? "revoked"
              : "active",
        })) ?? [],
    })),
  });
});

adminRouter.get("/usage", async (_req, res) => {
  const [endpointResult, consumerResult, recentRequestsResult] = await Promise.all([
    pool.query(
      `
        select endpoint, count(*)::int as total
        from api_requests
        where created_at >= now() - interval '24 hours'
        group by endpoint
        order by total desc
      `,
    ),
    pool.query(
      `
        select
          u.email,
          u.plan,
          count(ar.id)::int as total
        from api_requests ar
        join users u on u.id = ar.user_id
        where ar.created_at >= now() - interval '24 hours'
        group by u.email, u.plan
        order by total desc
        limit 10
      `,
    ),
    pool.query(
      `
        select
          ar.endpoint,
          ar.method,
          ar.status_code,
          ar.response_time_ms,
          ar.created_at,
          u.email,
          ak.key_prefix
        from api_requests ar
        left join users u on u.id = ar.user_id
        left join api_keys ak on ak.id = ar.api_key_id
        order by ar.created_at desc
        limit 25
      `,
    ),
  ]);

  return res.json({
    endpoints: endpointResult.rows,
    topConsumers: consumerResult.rows,
    recentRequests: recentRequestsResult.rows,
  });
});

adminRouter.post("/api-keys/:id/disable", async (req, res) => {
  const result = await pool.query(
    `
      update api_keys
      set disabled_at = now(), updated_at = now()
      where id = $1
      returning id
    `,
    [req.params.id],
  );

  if (!result.rowCount) {
    return res.status(404).json({ error: "API key not found." });
  }

  return res.json({ success: true });
});

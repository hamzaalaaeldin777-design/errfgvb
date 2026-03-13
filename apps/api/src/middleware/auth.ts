import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/postgres";
import { verifyToken } from "../lib/jwt";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Missing Bearer token." });
  }

  try {
    const payload = verifyToken(token);
    const result = await pool.query(
      `
        select id, name, email, role, plan
        from users
        where id = $1 and status = 'active'
      `,
      [payload.sub],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Session is no longer valid." });
    }

    req.authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.authUser || req.authUser.role !== "admin") {
    return res.status(403).json({ error: "Admin access is required." });
  }

  return next();
}


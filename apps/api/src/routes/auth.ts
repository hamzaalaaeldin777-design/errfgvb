import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/postgres";
import { signToken } from "../lib/jwt";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { requireAuth } from "../middleware/auth";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  company: z.string().max(100).optional().or(z.literal("")),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid registration payload.",
      details: parsed.error.flatten(),
    });
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await pool.query(
    `select id from users where email = $1`,
    [email],
  );

  if (existingUser.rowCount) {
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });
  }

  const userId = randomUUID();
  const passwordHash = hashPassword(parsed.data.password);

  await pool.query(
    `
      insert into users (id, name, email, company, password_hash, role, plan)
      values ($1, $2, $3, $4, $5, 'developer', 'free')
    `,
    [
      userId,
      parsed.data.name,
      email,
      parsed.data.company || null,
      passwordHash,
    ],
  );

  const token = signToken({
    sub: userId,
    role: "developer",
    plan: "free",
  });

  return res.status(201).json({
    token,
    user: {
      id: userId,
      name: parsed.data.name,
      email,
      company: parsed.data.company || null,
      role: "developer",
      plan: "free",
    },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid login payload.",
      details: parsed.error.flatten(),
    });
  }

  const email = parsed.data.email.toLowerCase();
  const result = await pool.query(
    `
      select id, name, email, company, role, plan, password_hash
      from users
      where email = $1 and status = 'active'
    `,
    [email],
  );

  const user = result.rows[0];

  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
    plan: user.plan,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company,
      role: user.role,
      plan: user.plan,
    },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: req.authUser });
});

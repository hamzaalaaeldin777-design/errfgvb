import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { PlanName } from "./plans";

type JwtPayload = {
  sub: string;
  role: "developer" | "admin";
  plan: PlanName;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  return decoded as JwtPayload;
}


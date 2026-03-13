import { createHash, randomBytes } from "node:crypto";

export function generateApiKey() {
  return `sport_live_${randomBytes(18).toString("hex")}`;
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function getKeyPrefix(apiKey: string) {
  return apiKey.slice(0, 16);
}


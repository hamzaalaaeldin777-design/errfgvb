import { verifyDatabase } from "../db/postgres";
import { ensureRedis } from "../db/redis";

let runtimePromise: Promise<void> | null = null;

export function ensureRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await verifyDatabase();
      await ensureRedis();
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }

  return runtimePromise;
}

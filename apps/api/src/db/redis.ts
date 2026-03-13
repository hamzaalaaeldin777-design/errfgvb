import { createClient } from "redis";
import { env } from "../config/env";

type MemoryValue = {
  value: number;
  expiresAt: number | null;
};

function createMemoryRedis() {
  const store = new Map<string, MemoryValue>();

  const getEntry = (key: string) => {
    const entry = store.get(key);

    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }

    return entry;
  };

  return {
    isOpen: true,
    on: () => undefined,
    connect: async () => undefined,
    incr: async (key: string) => {
      const entry = getEntry(key);
      const nextValue = (entry?.value ?? 0) + 1;
      store.set(key, {
        value: nextValue,
        expiresAt: entry?.expiresAt ?? null,
      });
      return nextValue;
    },
    expire: async (key: string, seconds: number) => {
      const entry = getEntry(key) ?? { value: 0, expiresAt: null };
      store.set(key, {
        value: entry.value,
        expiresAt: Date.now() + seconds * 1000,
      });
      return 1;
    },
  };
}

export const redis = env.REDIS_URL.startsWith("memory://")
  ? createMemoryRedis()
  : createClient({
      url: env.REDIS_URL,
    });

redis.on("error", (error) => {
  console.error("Redis connection error", error);
});

export async function ensureRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

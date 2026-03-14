import { createClient } from "redis";
import { env } from "../config/env";

type MemoryValue = {
  value: number;
  expiresAt: number | null;
};

type RedisLikeClient = {
  isOpen: boolean;
  on: (event: string, listener: (error: unknown) => void) => void;
  connect: () => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
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

function createUpstashRestRedis(): RedisLikeClient {
  const baseUrl = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Missing Upstash REST credentials.");
  }

  const execute = async (...segments: Array<string | number>) => {
    const encodedPath = segments.map((segment) =>
      encodeURIComponent(String(segment)),
    );
    const response = await fetch(`${baseUrl}/${encodedPath.join("/")}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Upstash request failed with ${response.status}: ${body || response.statusText}`,
      );
    }

    const payload = (await response.json()) as {
      error?: string;
      result?: number;
    };

    if (payload.error) {
      throw new Error(payload.error);
    }

    return typeof payload.result === "number" ? payload.result : 0;
  };

  return {
    isOpen: true,
    on: () => undefined,
    connect: async () => undefined,
    incr: (key: string) => execute("incr", key),
    expire: (key: string, seconds: number) => execute("expire", key, seconds),
  };
}

function createRedisClient(): RedisLikeClient {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return createUpstashRestRedis();
  }

  if (env.REDIS_URL.startsWith("memory://")) {
    return createMemoryRedis();
  }

  return createClient({
    url: env.REDIS_URL,
  });
}

export const redis = createRedisClient();

redis.on("error", (error) => {
  console.error("Redis connection error", error);
});

export async function ensureRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

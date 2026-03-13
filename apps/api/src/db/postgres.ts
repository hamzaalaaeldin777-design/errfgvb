import { readFileSync } from "node:fs";
import path from "node:path";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { DataType, newDb } from "pg-mem";
import { env } from "../config/env";

function resolveDemoSql(filename: string) {
  return path.join(process.cwd(), "src", "db", filename);
}

function createInMemoryPool() {
  const db = newDb({
    autoCreateForeignKeyIndices: true,
  });

  db.public.registerFunction({
    name: "current_database",
    returns: DataType.text,
    implementation: () => "sportstack_demo",
  });

  db.public.registerFunction({
    name: "version",
    returns: DataType.text,
    implementation: () => "pg-mem",
  });

  db.public.registerFunction({
    name: "date_trunc",
    args: [DataType.text, DataType.timestamp],
    returns: DataType.timestamp,
    implementation: (precision, value) => {
      const date = new Date(value);

      if (precision === "day") {
        date.setHours(0, 0, 0, 0);
      }

      return date;
    },
  });

  db.public.registerFunction({
    name: "to_char",
    args: [DataType.timestamp, DataType.text],
    returns: DataType.text,
    implementation: (value, format) => {
      const date = new Date(value);

      if (format === "YYYY-MM-DD") {
        return date.toISOString().slice(0, 10);
      }

      return date.toISOString();
    },
  });

  db.public.none(readFileSync(resolveDemoSql("demo-schema.sql"), "utf8"));
  db.public.none(readFileSync(resolveDemoSql("demo-seed.sql"), "utf8"));

  const adapter = db.adapters.createPg();
  return new adapter.Pool();
}

export const pool = env.DATABASE_URL.startsWith("memory://")
  ? createInMemoryPool()
  : new Pool({
      connectionString: env.DATABASE_URL,
    });

if (!env.DATABASE_URL.startsWith("memory://")) {
  attachDatabasePool(pool);
}

export async function verifyDatabase() {
  await pool.query("select 1");
}

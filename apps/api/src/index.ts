import "express";
import { env } from "./config/env";
import { app } from "./app";
import { ensureRuntime } from "./lib/runtime";

export default app;

async function bootstrap() {
  await ensureRuntime();

  app.listen(env.PORT, () => {
    console.log(`SportStack API listening on port ${env.PORT}`);
  });
}

if (process.env.VERCEL !== "1") {
  bootstrap().catch((error) => {
    console.error("Failed to start API", error);
    process.exit(1);
  });
}

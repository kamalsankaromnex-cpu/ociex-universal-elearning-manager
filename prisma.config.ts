import { defineConfig } from "prisma/config";
import { config } from "dotenv";
config({ quiet: true });
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL! },
});

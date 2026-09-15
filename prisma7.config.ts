import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    /*
     * The CLI (migrate, db seed, studio) talks to the database directly.
     * Neon's pooled endpoint sits behind PgBouncer in transaction mode, which
     * does not support the schema-changing statements a migration runs, so
     * migrations use the unpooled URL. The app itself uses the pooled one —
     * see src/lib/prisma.ts.
     */
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});

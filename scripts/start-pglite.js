const { PGlite } = require("@electric-sql/pglite");
const { createServer } = require("pglite-server");
const fs = require("fs");
const path = require("path");

async function main() {
  const dataDir = path.join(__dirname, "../.pglite-data");
  const db = new PGlite(dataDir);
  await db.waitReady;
  console.log("PGlite database engine ready.");

  // Check if migrations needed
  try {
    const res = await db.query("SELECT to_regclass('public.\"Admin\"') as exists;");
    if (!res.rows[0].exists) {
      console.log("Applying migrations to PGlite...");
      const initSql = fs.readFileSync(
        path.join(__dirname, "../prisma/migrations/20261104000000_init/migration.sql"),
        "utf8"
      );
      await db.exec(initSql);

      const pubSql = fs.readFileSync(
        path.join(__dirname, "../prisma/migrations/20261104010000_publishing_management/migration.sql"),
        "utf8"
      );
      await db.exec(pubSql);
      console.log("Migrations applied successfully.");
    } else {
      console.log("Database schema already exists.");
    }
  } catch (err) {
    console.error("Migration error:", err);
  }

  const server = createServer(db);
  server.listen(5432, "127.0.0.1", () => {
    console.log("PGlite wire-protocol server listening on 127.0.0.1:5432");
  });
}

main().catch(console.error);

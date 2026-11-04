// Validate deployable migrations in an isolated disposable PostgreSQL database.
// No existing course database is reset or seeded by this check.
import pg from "pg";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
const databaseName = `coursecraft_migration_${randomBytes(6).toString("hex")}`;
const controller = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});
const isolatedUrl = new URL(process.env.DATABASE_URL);
isolatedUrl.pathname = `/${databaseName}`;
let isolated;
await controller.connect();
try {
  await controller.query(`CREATE DATABASE "${databaseName}"`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_URL: isolatedUrl.toString() },
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.on("error", () =>
      reject(new Error("Migration subprocess could not start")),
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Fresh database migration failed")),
    );
  });
  isolated = new pg.Client({ connectionString: isolatedUrl.toString() });
  await isolated.connect();
  await isolated.query(
    `INSERT INTO "Admin" (id,email,"passwordHash") VALUES ('fixture-admin','migration@example.test','not-a-login-account')`,
  );
  await isolated.query(
    `INSERT INTO "Course" (id,"adminId",title,data,"updatedAt") VALUES ('fixture-course','fixture-admin','Migration fixture','{}',CURRENT_TIMESTAMP)`,
  );
  await isolated.query(
    `INSERT INTO "PublishedExport" (id,"courseId",revision,"revisionIdentifier",version,scope,fingerprint,status,snapshot,metadata,validation) VALUES ('fixture-export','fixture-course',1,'fixture-course:r1','2004','course','','failed','{}','{}','{}')`,
  );
  const updated = await isolated.query(
    `UPDATE "PublishedExport" SET revision=2 WHERE id='fixture-export'`,
  );
  if (updated.rowCount !== 0) throw new Error("Export immutability failed");
  const fields = `(id,"exportId",platform,edition,"testedVersion",tester,"testedAt",result,evidence,"importVerified","launchVerified","debugVerified")`;
  let rejected = false;
  try {
    await isolated.query(
      `INSERT INTO "LmsAcceptance" ${fields} VALUES ('invalid','fixture-export','Fixture','2004','Fixture','Fixture',CURRENT_TIMESTAMP,'passed','Evidence is descriptive enough',false,false,false)`,
    );
  } catch (error) {
    rejected = error.code === "23514";
  }
  if (!rejected) throw new Error("Acceptance evidence constraint failed");
  await isolated.query(
    `INSERT INTO "LmsAcceptance" ${fields} VALUES ('valid','fixture-export','Fixture','2004','Fixture','Fixture',CURRENT_TIMESTAMP,'unverified','Not externally verified',false,false,false)`,
  );
  const acceptanceUpdate = await isolated.query(
    `UPDATE "LmsAcceptance" SET result='blocked' WHERE id='valid'`,
  );
  if (acceptanceUpdate.rowCount !== 0)
    throw new Error("Acceptance immutability failed");
  await isolated.query(`DELETE FROM "Course" WHERE id='fixture-course'`);
  if (
    Number(
      (await isolated.query(`SELECT count(*) FROM "PublishedExport"`)).rows[0]
        .count,
    ) !== 0
  )
    throw new Error("Archive cascade cleanup failed");
  console.log(
    "Fresh migrations, export/acceptance immutability, evidence constraints and cascade cleanup passed.",
  );
} finally {
  if (isolated) await isolated.end();
  await controller.query(
    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
  );
  await controller.end();
}

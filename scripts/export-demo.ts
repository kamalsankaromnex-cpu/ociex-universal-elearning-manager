import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CourseExportService } from "../src/lib/publishing/service";
import { validateManifest } from "./validate-scorm";
import { strFromU8 } from "fflate";
import { PackageBuilder } from "../src/lib/publishing/package-builder";
import { ExportValidator } from "../src/lib/publishing/validator";
import { trackingQaCourse } from "../src/lib/publishing/qa-course";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
async function main() {
  const admin = await db.admin.findUniqueOrThrow({
      where: { email: process.env.ADMIN_EMAIL!.toLowerCase() },
    }),
    record = await db.course.findFirstOrThrow({
      where: { adminId: admin.id, title: "Daimler EHS" },
    });
  const data = record.data as { levels: { id: string }[] };
  await mkdir("deliverables/scorm", { recursive: true });
  type BuiltPackage = Awaited<ReturnType<PackageBuilder["build"]>>;
  const report: Array<
    BuiltPackage["metadata"] & {
      file: string;
      schemaValidation: ReturnType<typeof validateManifest>;
      bytes: number;
      packagedFiles: number;
    }
  > = [];
  const integrity: Array<{
    file: string;
    sha256: string;
    entries: number;
    secretValueMatches: number;
    manifestAtRoot: boolean;
    metadata: BuiltPackage["metadata"];
  }> = [];
  async function savePackage(
    filename: string,
    result: Awaited<ReturnType<PackageBuilder["build"]>>,
    version: "1.2" | "2004",
  ) {
    const validation = validateManifest(
      strFromU8(result.files["imsmanifest.xml"]),
      version,
    );
    if (!validation.valid || validation.errors.length)
      throw new Error(JSON.stringify(validation));
    for (const [path, bytes] of Object.entries(result.files)) {
      if (/(^|\/)(\.env|node_modules|src|\.git)(\/|$)/.test(path))
        throw new Error("Forbidden package member");
      for (const key of ["ADMIN_PASSWORD", "SESSION_SECRET", "DATABASE_URL"])
        if (
          process.env[key] &&
          Buffer.from(bytes).includes(Buffer.from(process.env[key]!))
        )
          throw new Error("Configured credential value found in package");
    }
    await writeFile(`deliverables/scorm/${filename}`, result.zip);
    integrity.push({
      file: filename,
      sha256: createHash("sha256").update(result.zip).digest("hex"),
      entries: Object.keys(result.files).length,
      secretValueMatches: 0,
      manifestAtRoot: !!result.files["imsmanifest.xml"],
      metadata: result.metadata,
    });
    report.push({
      file: filename,
      ...result.metadata,
      schemaValidation: validation,
      bytes: result.zip.length,
      packagedFiles: Object.keys(result.files).length,
    });
  }
  for (const scope of ["level", "course"] as const)
    for (const version of ["1.2", "2004"] as const) {
      const result = await new CourseExportService().export(
        admin.id,
        record.id,
        {
          revision: record.revision,
          scope,
          version,
          levelId: data.levels[0].id,
        },
      );
      await savePackage(
        `Daimler-EHS-${scope === "level" ? "Level-01" : "Full-Course"}-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}.zip`,
        result,
        version,
      );
    }
  for (const version of ["1.2", "2004"] as const) {
    const course = trackingQaCourse(),
      request = { revision: 1, scope: "course" as const, version };
    const validation = new ExportValidator().validate(course, request);
    if (validation.errors.length) throw new Error(validation.errors.join(" "));
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ fixture: "tracking-qa-v1", version, course }))
      .digest("hex");
    const result = await new PackageBuilder().build(
      course,
      request,
      fingerprint,
    );
    await savePackage(
      `SCORM-Tracking-QA-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}.zip`,
      result,
      version,
    );
  }
  await writeFile(
    "deliverables/scorm/manifest-validation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    "deliverables/scorm/integrity-report.json",
    JSON.stringify(
      { date: new Date().toISOString().slice(0, 10), packages: integrity },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      report.map((r) => ({
        file: r.file,
        revision: r.revision,
        valid: r.schemaValidation.valid,
        bytes: r.bytes,
      })),
      null,
      2,
    ),
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Export failed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

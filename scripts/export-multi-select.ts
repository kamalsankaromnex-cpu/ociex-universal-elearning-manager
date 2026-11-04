import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { machineGuardingCourse } from "../src/lib/machine-guarding-sample";
import { courseSchema } from "../src/lib/course";
import { PackageBuilder } from "../src/lib/publishing/package-builder";
import { ExportValidator } from "../src/lib/publishing/validator";
import { PUBLISHER_VERSION } from "../src/lib/publishing/types";
import { validateManifest } from "./validate-scorm";
async function main() {
  const directory = "deliverables/multi-select";
  await mkdir(directory, { recursive: true });
  const course = courseSchema.parse(machineGuardingCourse());
  await writeFile(
    `${directory}/Machine-Guarding-Demonstration.json`,
    JSON.stringify(course, null, 2) + "\n",
  );
  const report = [];
  for (const version of ["1.2", "2004"] as const) {
    const request = { revision: 1, version, scope: "course" as const };
    const validation = new ExportValidator().validate(course, request);
    if (validation.errors.length) throw new Error(validation.errors.join(" "));
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          publisherVersion: PUBLISHER_VERSION,
          version,
          course,
        }),
      )
      .digest("hex");
    const built = await new PackageBuilder().build(
      course,
      request,
      fingerprint,
    );
    const file = `Machine-Guarding-Multi-Select-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}.zip`;
    let configuredCredentialMatches = 0;
    for (const bytes of Object.values(built.files))
      for (const key of ["DATABASE_URL", "SESSION_SECRET", "ADMIN_PASSWORD"])
        if (
          process.env[key] &&
          Buffer.from(bytes).includes(Buffer.from(process.env[key]!))
        )
          configuredCredentialMatches++;
    if (configuredCredentialMatches)
      throw new Error("Configured credential found in sample package");
    const manifest = validateManifest(
      strFromU8(unzipSync(built.zip)["imsmanifest.xml"]),
      version,
    );
    if (!manifest.valid) throw new Error("Sample manifest validation failed");
    await writeFile(`${directory}/${file}`, built.zip);
    report.push({
      file,
      sha256: createHash("sha256").update(built.zip).digest("hex"),
      bytes: built.zip.length,
      metadata: built.metadata,
      validation,
      manifest,
      configuredCredentialMatches,
      externalLmsVerification: "unverified",
    });
  }
  await writeFile(
    `${directory}/export-report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    report.map((r) => ({
      file: r.file,
      bytes: r.bytes,
      manifestValid: r.manifest.valid,
      configuredCredentialMatches: r.configuredCredentialMatches,
    })),
  );
}
main().catch(() => {
  console.error(
    "Multi-select sample export failed; review source validation locally.",
  );
  process.exitCode = 1;
});

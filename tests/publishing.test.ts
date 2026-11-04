import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { newCourse, demoCourse } from "../src/lib/course";
import { PackageBuilder } from "../src/lib/publishing/package-builder";
import { ExportValidator } from "../src/lib/publishing/validator";
import { validateManifest } from "../scripts/validate-scorm";
import { CourseExportService } from "../src/lib/publishing/service";
const mocked = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("../src/lib/db", () => ({
  db: { course: { findFirst: mocked.findFirst } },
}));
for (const version of ["1.2", "2004"] as const)
  for (const scope of ["level", "course"] as const)
    describe(`${version} ${scope} package`, () => {
      it("validates genuine namespaces/sequencing against distributed XSDs and packages every relative asset", async () => {
        const course = demoCourse();
        course.title = 'XML & <escaping> "test"';
        const image =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHyQAAAAASUVORK5CYII=";
        course.levels[0].slides[0].image = image;
        course.theme.logo = image;
        course.theme.backgroundImage = image;
        const req = {
          revision: 1,
          scope,
          version,
          levelId: course.levels[0].id,
        };
        const builder = new PackageBuilder(),
          result = await builder.build(
            new ExportValidator().select(course, req),
            req,
            "f".repeat(64),
          );
        const files = unzipSync(result.zip),
          manifest = strFromU8(files["imsmanifest.xml"]);
        const validation = validateManifest(manifest, version);
        expect(validation.errors).toEqual([]);
        expect(validation.valid).toBe(true);
        expect(
          validateManifest(
            manifest.replace('identifier="RES_LESSON"', ""),
            "2004" === version ? "2004" : "1.2",
          ).valid,
        ).toBe(false);
        expect(Object.keys(files)).toContain("assets/player.js");
        expect(Object.keys(files)).toContain(
          "assets/fonts/inter-latin-400-normal.woff2",
        );
        for (const m of manifest.matchAll(/<file href="([^"]+)"/g)) {
          expect(m[1]).not.toMatch(/^(https?:|\/)|\.\./);
          expect(files[m[1]], `Missing ${m[1]}`).toBeDefined();
        }
        const html = strFromU8(files["index.html"]);
        for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g))
          expect(files[m[1]]).toBeDefined();
        const data = strFromU8(files["assets/course.js"]);
        expect(
          Object.keys(files).filter((f) => f.startsWith("assets/media/")),
        ).toHaveLength(1);
        expect(data).not.toContain("data:image/png;base64,");
        expect(data).not.toMatch(
          /adminId|passwordHash|SESSION_SECRET|DATABASE_URL/,
        );
      });
    });
it("rejects empty levels, unsupported level ids and 1.2 packages exceeding guaranteed resume capacity", () => {
  const v = new ExportValidator(),
    c = newCourse("test"),
    request = {
      revision: 1,
      version: "1.2" as const,
      scope: "level" as const,
      levelId: "missing",
    };
  expect(() => v.select(c, request)).toThrow();
  c.levels[0].slides = [];
  expect(v.validate(c, request).errors.length).toBeGreaterThan(0);
});
it("refuses stale committed revision before building and changed revision during export", async () => {
  const course = newCourse("revision");
  const record = { id: "owned", revision: 2, data: course };
  const request = {
    revision: 1,
    version: "1.2" as const,
    scope: "course" as const,
  };
  mocked.findFirst.mockResolvedValueOnce(record);
  await expect(
    new CourseExportService().export("admin", "owned", request),
  ).rejects.toMatchObject({ status: 409 });
  mocked.findFirst
    .mockResolvedValueOnce({ ...record, revision: 1 })
    .mockResolvedValueOnce({ revision: 2 });
  await expect(
    new CourseExportService().export("admin", "owned", request),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocked.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "owned", adminId: "admin" } }),
  );
});

it("preserves the pinned distributed schema bytes", async () => {
  const checksums = JSON.parse(
    await readFile("vendor/scorm/checksums.json", "utf8"),
  ) as Record<string, string>;
  for (const [path, expected] of Object.entries(checksums)) {
    const bytes = await readFile(`vendor/scorm/${path}`);
    expect(createHash("sha256").update(bytes).digest("hex"), path).toBe(
      expected,
    );
  }
});

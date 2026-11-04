import { validateManifest } from "./schema-validation";
import { build } from "esbuild";
import { zipSync, strToU8 } from "fflate";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { CourseData } from "../course";
import { PUBLISHER_VERSION, type ExportRequest } from "./types";
import { ManifestGenerator12, ManifestGenerator2004 } from "./manifests";
let bundle: Promise<string> | undefined;
async function playerBundle() {
  bundle ??= build({
    entryPoints: ["src/player/entry.tsx"],
    bundle: true,
    write: false,
    minify: true,
    platform: "browser",
    format: "iife",
    target: "es2020",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  })
    .then((r) => r.outputFiles[0].text)
    .catch((e) => {
      bundle = undefined;
      throw e;
    });
  return bundle;
}
export class PackageBuilder {
  async build(course: CourseData, request: ExportRequest, fingerprint: string) {
    const files: Record<string, Uint8Array> = {};
    const copy = JSON.parse(JSON.stringify(course)) as CourseData;
    function media(value: string) {
      if (!value) return "";
      const match =
        /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
          value,
        );
      if (!match)
        throw new Error("Package media must be an uploaded raster image.");
      const bytes = Buffer.from(match[2], "base64"),
        path = `assets/media/${createHash("sha256").update(bytes).digest("hex")}.${match[1]}`;
      files[path] = bytes;
      return path;
    }
    copy.theme.logo = media(copy.theme.logo);
    copy.theme.backgroundImage = media(copy.theme.backgroundImage);
    for (const l of copy.levels)
      for (const s of l.slides) {
        s.image = media(s.image);
        for (const option of s.options)
          if (option.image) option.image = media(option.image);
        for (const block of s.composition?.blocks ?? []) {
          if (block.kind === "media") block.src = media(block.src);
          if (block.kind === "interaction")
            for (const option of block.question.options)
              if (option.image) option.image = media(option.image);
        }
      }
    const metadata = {
      publisher: "Coursecraft",
      format:
        request.version === "1.2" ? "SCORM 1.2" : "SCORM 2004 4th Edition",
      revision: request.revision,
      scope: request.scope,
      level: request.scope === "level" ? copy.levels[0].title : null,
      title: copy.title,
      fingerprint,
      exportedAt: new Date().toISOString(),
      singleSco: true,
      publisherVersion: PUBLISHER_VERSION,
      scoringPolicy: {
        passingScore: copy.rules?.passScore ?? 80,
        optional: copy.rules?.optionalScoring ?? "include",
        unanswered: copy.rules?.unansweredScoring ?? "zero",
        unscored: "excluded",
        answerCredit: "best-credit-in-level-attempt",
        completion: copy.levels.some((l) => l.slides.some((s) => s.composition))
          ? "configured-slides-activities-and-life-positive"
          : "all-visited-mandatory-correct-life-positive",
      },
    };
    files["assets/player.js"] = strToU8(await playerBundle());
    files["assets/course.js"] = strToU8(
      `window.__COURSECRAFT_PACKAGE__=${JSON.stringify({
        course: copy,
        version: request.version,
        fingerprint,
        metadata,
      })
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029")};`,
    );
    let css = (await readFile("src/app/globals.css", "utf8")).replace(
      /@tailwind[^;]+;/g,
      "",
    );
    for (const weight of [400, 500, 600, 700]) {
      const name = `inter-latin-${weight}-normal.woff2`;
      files[`assets/fonts/${name}`] = await readFile(
        `node_modules/@fontsource/inter/files/${name}`,
      );
      css += `\n@font-face{font-family:Inter;font-style:normal;font-weight:${weight};font-display:swap;src:url("fonts/${name}") format("woff2")}`;
    }
    files["assets/player.css"] = strToU8(css);
    files["index.html"] = strToU8(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Learning experience</title><link rel="stylesheet" href="assets/player.css"><script defer src="assets/course.js"></script><script defer src="assets/player.js"></script></head><body><div id="root"></div><noscript>This lesson requires JavaScript.</noscript></body></html>',
    );
    files["export-metadata.json"] = strToU8(JSON.stringify(metadata, null, 2));
    const licenses = await Promise.all(
      ["react", "react-dom", "lucide-react", "zod", "@fontsource/inter"].map(
        async (name) =>
          `--- ${name} ---\n${await readFile(`node_modules/${name}/LICENSE`, "utf8")}`,
      ),
    );
    files["THIRD-PARTY-LICENSES.txt"] = strToU8(licenses.join("\n\n"));
    const schemaDir = `vendor/scorm/${request.version}`;
    for (const f of await readdir(schemaDir))
      files[f] = await readFile(join(schemaDir, f));
    files["SCHEMA-SOURCE-LICENSE.txt"] = await readFile(
      "vendor/scorm/SOURCE-LICENSE",
    );
    const manifest =
      request.version === "1.2"
        ? new ManifestGenerator12()
        : new ManifestGenerator2004();
    files["imsmanifest.xml"] = strToU8(
      manifest.generate(
        request.scope === "level" ? copy.levels[0].title : copy.title,
        fingerprint,
        Object.keys(files).sort(),
      ),
    );
    const validation = validateManifest(
      new TextDecoder().decode(files["imsmanifest.xml"]),
      request.version,
    );
    if (!validation.valid)
      throw new Error("Generated manifest failed schema validation");
    const zip = zipSync(
      Object.fromEntries(
        Object.entries(files).map(([path, bytes]) => [
          path,
          [bytes, { mtime: new Date("2020-01-01T00:00:00Z") }],
        ]),
      ),
      { level: 6 },
    );
    return { zip, metadata, files };
  }
}

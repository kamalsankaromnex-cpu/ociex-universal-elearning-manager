import { expect, it } from "vitest";
import { Scorm2004API } from "scorm-again/scorm2004";
import { Scorm12API } from "scorm-again/scorm12";
import { Scorm12Adapter, Scorm2004Adapter } from "../src/lib/scorm/adapters";
import { ScormSessionManager } from "../src/lib/scorm/session";
import { machineGuardingCourse } from "../src/lib/machine-guarding-sample";
import { normalizeSubmission } from "../src/lib/interactions";
import { assessment, finishGame, submitQuestion, visit } from "../src/lib/game";
import type { ScormApi } from "../src/lib/scorm/types";
import { PackageBuilder } from "../src/lib/publishing/package-builder";
import { unzipSync, strFromU8 } from "fflate";
for (const version of ["1.2", "2004"] as const) {
  function runtime() {
    const api =
      version === "1.2"
        ? new Scorm12API({ logLevel: 5, autocommit: false })
        : new Scorm2004API({ logLevel: 5, autocommit: false });
    if (api instanceof Scorm12API) api.cmi.core.entry = "ab-initio";
    else api.cmi.entry = "ab-initio";
    return {
      api,
      adapter:
        version === "1.2"
          ? new Scorm12Adapter(api as unknown as ScormApi)
          : new Scorm2004Adapter(api as unknown as ScormApi),
      get: (key: string) =>
        api instanceof Scorm12API ? api.LMSGetValue(key) : api.GetValue(key),
    };
  }
  it(`${version} independent runtime retains partial credit, selection and penalty across resume, then completes exactly`, () => {
    const course = machineGuardingCourse(),
      slide = course.levels[0].slides[0],
      first = runtime();
    const manager = new ScormSessionManager(
      first.adapter,
      course,
      "multi-runtime",
    );
    let state = visit(course, manager.initialize(), 0);
    state = submitQuestion(course, state, normalizeSubmission(slide, ["a"]));
    manager.save(state);
    expect(
      first.get(version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"),
    ).toBe("50");
    expect(
      first.get(
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status",
      ),
    ).toBe("incomplete");
    const data = first.get("cmi.suspend_data");
    manager.terminate(state);
    const second = runtime();
    second.api.loadFromJSON({
      cmi:
        version === "1.2"
          ? {
              core: {
                entry: "resume",
                lesson_status: "incomplete",
                lesson_location: "0",
              },
              suspend_data: data,
            }
          : {
              entry: "resume",
              completion_status: "incomplete",
              location: "0",
              suspend_data: data,
            },
    });
    const resumed = new ScormSessionManager(
      second.adapter,
      course,
      "multi-runtime",
    );
    let restored = resumed.initialize();
    expect(restored.multi?.[0]).toEqual({ selection: 1, credit: 5000 });
    expect(restored.life).toBe(75);
    expect(assessment(course, restored).score).toBe(50);
    restored = submitQuestion(
      course,
      restored,
      normalizeSubmission(slide, ["a"]),
    );
    expect(restored.life).toBe(75);
    restored = finishGame(
      course,
      submitQuestion(course, restored, normalizeSubmission(slide, ["a", "b"])),
    );
    resumed.save(restored);
    expect(
      second.get(version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"),
    ).toBe("100");
    expect(
      second.get(
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status",
      ),
    ).toBe(version === "1.2" ? "passed" : "completed");
    if (version === "2004") {
      expect(second.get("cmi.success_status")).toBe("passed");
      expect(second.get("cmi.objectives.0.score.scaled")).toBe("1");
    }
    resumed.terminate(restored);
  });
  it(`${version} packages multi-select data and optional answer images using the shared standalone renderer`, async () => {
    const course = machineGuardingCourse();
    course.levels[0].slides[0].options[0].image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHyQAAAAASUVORK5CYII=";
    course.levels[0].slides[0].options[0].imageAlt =
      "Illustrative fixed barrier";
    const result = await new PackageBuilder().build(
      course,
      { revision: 1, version, scope: "course" },
      "multi-image",
    );
    const files = unzipSync(result.zip);
    const payload = JSON.parse(
      strFromU8(files["assets/course.js"])
        .replace(/^window\.__COURSECRAFT_PACKAGE__=/, "")
        .replace(/;$/, ""),
    );
    const option = payload.course.levels[0].slides[0].options[0];
    expect(option.image).toMatch(/^assets\/media\//);
    expect(files[option.image]).toBeDefined();
    expect(option.imageAlt).toBe("Illustrative fixed barrier");
    expect(payload.course.levels[0].slides[0]).toMatchObject({
      kind: "multi-select",
      correctIds: ["a", "b"],
      scoringMode: "partial-credit",
    });
    expect(strFromU8(files["assets/player.js"])).not.toContain("DATABASE_URL");
  });
}

import { expect, it } from "vitest";
import { Scorm12API } from "scorm-again/scorm12";
import { Scorm2004API } from "scorm-again/scorm2004";
import { Scorm12Adapter, Scorm2004Adapter } from "../src/lib/scorm/adapters";
import { ScormSessionManager } from "../src/lib/scorm/session";
import type { ScormApi } from "../src/lib/scorm/types";
import { composerDemoCourse } from "../src/lib/composer/sample";
import { questionSlide } from "../src/lib/composer/model";
import {
  initialGame,
  visit,
  activateBlock,
  submitQuestion,
  finishGame,
} from "../src/lib/game";
import { normalizeSubmission } from "../src/lib/interactions";
for (const version of ["1.2", "2004"] as const)
  it(`${version} independent runtime resumes multiple blocks and reports aggregate completion without a new adapter`, () => {
    const course = composerDemoCourse();
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
    function submit(
      state: ReturnType<typeof initialGame>,
      id: string,
      answers: string[],
    ) {
      const slide = course.levels[0].slides[state.index],
        b = slide.composition!.blocks.find((b) => b.id === id);
      if (b?.kind !== "interaction") throw Error();
      return submitQuestion(
        course,
        state,
        normalizeSubmission(questionSlide(slide, b), answers),
      );
    }
    const first = runtime(),
      manager = new ScormSessionManager(
        first.adapter,
        course,
        "composer-runtime",
      );
    let state = visit(course, manager.initialize(), 0);
    state = activateBlock(course, state, "intro:reveal");
    state = activateBlock(course, state, "intro:complete");
    state = visit(course, state, 1);
    state = submit(state, "mixed:first", ["a"]);
    state = submit(state, "mixed:second", ["a"]);
    manager.save(state);
    expect(
      first.get(version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"),
    ).toBe("75");
    expect(
      first.get(
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status",
      ),
    ).toBe("incomplete");
    const data = first.get("cmi.suspend_data");
    expect(JSON.parse(data)[0]).toBe(3);
    manager.terminate(state);
    const second = runtime();
    second.api.loadFromJSON({
      cmi:
        version === "1.2"
          ? {
              core: {
                entry: "resume",
                lesson_location: "1",
                lesson_status: "incomplete",
              },
              suspend_data: data,
            }
          : {
              entry: "resume",
              location: "1",
              completion_status: "incomplete",
              suspend_data: data,
            },
    });
    const resumed = new ScormSessionManager(
      second.adapter,
      course,
      "composer-runtime",
    );
    let restored = resumed.initialize();
    expect(restored.composer).toEqual(state.composer);
    expect(restored.life).toBe(75);
    restored = submit(restored, "mixed:second", ["a"]);
    expect(restored.life).toBe(75);
    restored = finishGame(course, submit(restored, "mixed:second", ["a", "b"]));
    expect(restored.finished).toBe(true);
    resumed.save(restored);
    expect(
      second.get(version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"),
    ).toBe("100");
    expect(
      second.get(
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status",
      ),
    ).toBe(version === "1.2" ? "passed" : "completed");
    resumed.terminate(restored);
  });

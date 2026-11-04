import { describe, it, expect } from "vitest";
import { Scorm2004API } from "scorm-again/scorm2004";
import { Scorm12API } from "scorm-again/scorm12";
import { Scorm12Adapter, Scorm2004Adapter } from "../src/lib/scorm/adapters";
import { ScormSessionManager } from "../src/lib/scorm/session";
import { demoCourse, newCourse, newSlide } from "../src/lib/course";
import {
  visit,
  answerQuestion,
  finishGame,
  initialGame,
} from "../src/lib/game";
import { ResumeStateSerializer } from "../src/lib/scorm/resume";
import type { ScormApi, ScormVersion } from "../src/lib/scorm/types";
function runtime(version: ScormVersion) {
  if (version === "1.2") {
    const api = new Scorm12API({ logLevel: 5, autocommit: false });
    api.cmi.core.entry = "ab-initio";
    return {
      api,
      adapter: new Scorm12Adapter(api as unknown as ScormApi),
      get: (key: string) => api.LMSGetValue(key),
    };
  }
  const api = new Scorm2004API({ logLevel: 5, autocommit: false });
  api.cmi.entry = "ab-initio";
  return {
    api,
    adapter: new Scorm2004Adapter(api as unknown as ScormApi),
    get: (key: string) => api.GetValue(key),
  };
}
it("independent SCORM 2004 runtime reproduces uninitialized bookmark error 403", () => {
  const api = new Scorm2004API({ logLevel: 5, autocommit: false });
  api.cmi.entry = "ab-initio";
  expect(api.Initialize("")).toBe("true");
  expect(api.GetValue("cmi.location")).toBe("");
  expect(String(api.GetLastError())).toBe("403");
  expect(api.Terminate("")).toBe("true");
});
for (const version of ["1.2", "2004"] as const)
  describe(`independent ${version} runtime (not SCORM Cloud)`, () => {
    it("fresh launch is incomplete with score 0; mandatory completion becomes passed with score 100", () => {
      const r = runtime(version),
        course = demoCourse(),
        session = new ScormSessionManager(r.adapter, course, "independent");
      let s = visit(course, session.initialize(), 0);
      session.save(s);
      expect(
        r.get(
          version === "1.2"
            ? "cmi.core.lesson_status"
            : "cmi.completion_status",
        ),
      ).toBe("incomplete");
      expect(
        r.get(version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"),
      ).toBe("0");
      s = visit(course, s, 2);
      s = answerQuestion(course, s, "b");
      session.save(finishGame(course, s));
      expect(s.life).toBe(75);
      expect(
        r.get(
          version === "1.2"
            ? "cmi.core.lesson_status"
            : "cmi.completion_status",
        ),
      ).toBe("incomplete");
      s = answerQuestion(course, s, "a");
      session.save(s);
      if (version === "2004") {
        expect(r.get("cmi.success_status")).toBe("passed");
        expect(r.get("cmi.completion_status")).toBe("incomplete");
      }
      s = finishGame(course, visit(course, s, 1));
      session.save(s);
      expect(
        r.get(
          version === "1.2"
            ? "cmi.core.lesson_status"
            : "cmi.completion_status",
        ),
      ).toBe(version === "1.2" ? "passed" : "completed");
      expect(
        r.get(version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"),
      ).toBe("100");
      if (version === "2004")
        expect(r.get("cmi.success_status")).toBe("passed");
      session.terminate(s);
    });
    it("restores the bookmark, 75% life and prior penalty through a fresh LMS runtime", () => {
      const course = demoCourse(),
        r = runtime(version),
        session = new ScormSessionManager(r.adapter, course, "resume");
      let state = visit(course, session.initialize(), 2);
      state = answerQuestion(course, state, "b");
      session.save(state);
      const data = r.get("cmi.suspend_data");
      session.terminate(state);
      const second = runtime(version);
      second.api.loadFromJSON(
        version === "1.2"
          ? {
              cmi: {
                core: {
                  entry: "resume",
                  lesson_location: "2",
                  lesson_status: "incomplete",
                },
                suspend_data: data,
              },
            }
          : {
              cmi: {
                entry: "resume",
                location: "2",
                completion_status: "incomplete",
                suspend_data: data,
              },
            },
      );
      const resumed = new ScormSessionManager(second.adapter, course, "resume");
      const actual = resumed.initialize();
      expect(actual).toEqual(state);
      expect(answerQuestion(course, actual, "b").life).toBe(75);
      resumed.terminate(actual);
    });
    it("completed normal-entry review does not reset completion or write a new grade", () => {
      const course = demoCourse();
      let state = answerQuestion(course, visit(course, initialGame(), 2), "a");
      state = visit(course, state, 0);
      state = finishGame(course, visit(course, state, 1));
      const data = ResumeStateSerializer.serialize(
          state,
          "review",
          3,
          1,
          version,
        ),
        r = runtime(version);
      r.api.loadFromJSON(
        version === "1.2"
          ? {
              cmi: {
                core: {
                  entry: "",
                  lesson_status: "passed",
                  lesson_location: "1",
                  score: { raw: "100" },
                },
                suspend_data: data,
              },
            }
          : {
              cmi: {
                entry: "",
                completion_status: "completed",
                success_status: "passed",
                location: "1",
                score: { raw: "100", scaled: "1" },
                suspend_data: data,
              },
            },
      );
      // The independent runtime's JSON loader skips empty strings. Set this
      // read-only LMS launch field explicitly before Initialize.
      if (r.api instanceof Scorm12API) r.api.cmi.core.entry = "";
      else r.api.cmi.entry = "";
      const session = new ScormSessionManager(r.adapter, course, "review");
      // Visitation is a set; compact bitset restoration returns sorted indices.
      expect(session.initialize()).toEqual({
        ...state,
        visited: [...state.visited].sort((a, b) => a - b),
      });
      expect(session.isReviewOnly).toBe(true);
      session.save(state);
      expect(
        r.get(
          version === "1.2"
            ? "cmi.core.lesson_status"
            : "cmi.completion_status",
        ),
      ).toBe(version === "1.2" ? "passed" : "completed");
      expect(
        r.get(version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"),
      ).toBe("100");
      session.terminate(state);
    });
    it("optional failed assessment is reportable only after required work is satisfied", () => {
      const course = newCourse("Optional fixture");
      course.levels[0].slides = [
        { ...newSlide("Optional"), kind: "single-choice", mandatory: false },
      ];
      const r = runtime(version),
        session = new ScormSessionManager(r.adapter, course, "optional");
      let state = visit(course, session.initialize(), 0);
      state = finishGame(course, answerQuestion(course, state, "b"));
      session.save(state);
      expect(
        r.get(
          version === "1.2" ? "cmi.core.lesson_status" : "cmi.success_status",
        ),
      ).toBe("failed");
      if (version === "2004") {
        expect(r.get("cmi.completion_status")).toBe("completed");
        expect(r.get("cmi.objectives.0.success_status")).toBe("failed");
        expect(r.get("cmi.objectives.0.completion_status")).toBe("completed");
        expect(r.get("cmi.objectives.0.score.scaled")).toBe("0");
      }
      session.terminate(state);
    });
  });

for (const preloaded of [false, true])
  it(`updates the manifest primary objective (${preloaded ? "LMS-created" : "content-created"}) before terminating`, () => {
    const api = new Scorm2004API({ logLevel: 5, autocommit: false });
    api.cmi.entry = "ab-initio";
    if (preloaded)
      api.loadFromJSON({
        cmi: { objectives: [{ id: "unrelated" }, { id: "course_objective" }] },
      });
    const course = demoCourse();
    const session = new ScormSessionManager(
      new Scorm2004Adapter(api as unknown as ScormApi),
      course,
      "objective",
    );
    let state = visit(course, session.initialize(), 0);
    session.save(state);
    const slot = preloaded ? 1 : 0;
    expect(api.GetValue(`cmi.objectives.${slot}.id`)).toBe("course_objective");
    expect(api.GetValue(`cmi.objectives.${slot}.completion_status`)).toBe(
      "incomplete",
    );
    state = visit(course, state, 1);
    state = answerQuestion(course, visit(course, state, 2), "a");
    session.save(finishGame(course, state));
    expect(api.GetValue(`cmi.objectives.${slot}.success_status`)).toBe(
      "passed",
    );
    expect(api.GetValue(`cmi.objectives.${slot}.completion_status`)).toBe(
      "completed",
    );
    expect(api.GetValue(`cmi.objectives.${slot}.score.scaled`)).toBe("1");
    expect(api.GetValue(`cmi.objectives.${slot}.progress_measure`)).toBe("1");
    expect(api.GetValue("cmi.objectives._count")).toBe(preloaded ? "2" : "1");
    session.terminate(finishGame(course, state));
  });

import { describe, it, expect } from "vitest";
import {
  Scorm12Adapter,
  Scorm2004Adapter,
  discoverApi,
} from "../src/lib/scorm/adapters";
import {
  ScormSessionManager,
  scorm12Time,
  scorm2004Time,
} from "../src/lib/scorm/session";
import { ResumeStateSerializer } from "../src/lib/scorm/resume";
import {
  initialGame,
  visit,
  answerQuestion,
  finishGame,
} from "../src/lib/game";
import { newCourse, newSlide } from "../src/lib/course";
import type { ScormVersion, ScormApi } from "../src/lib/scorm/types";
function mock(version: ScormVersion) {
  const values: Record<string, string> = {},
    calls: string[] = [];
  let error = "0",
    fail = false;
  const api: ScormApi = {};
  for (const prefix of [version === "1.2" ? "LMS" : ""]) {
    for (const method of [
      "Initialize",
      version === "1.2" ? "Finish" : "Terminate",
      "Commit",
    ])
      api[prefix + method] = () => {
        calls.push(method);
        error = "0";
        return "true";
      };
    api[prefix + "GetValue"] = (key) => {
      error = "0";
      return values[key] || "";
    };
    api[prefix + "SetValue"] = (key, value) => {
      calls.push(key);
      if (fail) {
        error = "351";
        return "false";
      }
      error = "0";
      values[key] = value;
      return "true";
    };
    api[prefix + "GetLastError"] = () => error;
  }
  return {
    api,
    values,
    calls,
    fail: () => {
      fail = true;
    },
  };
}
for (const version of ["1.2", "2004"] as const)
  describe(`SCORM ${version}`, () => {
    function fixture() {
      const c = newCourse("Test");
      c.levels[0].slides = [{ ...newSlide("Quiz"), kind: "single-choice" }];
      const m = mock(version),
        adapter =
          version === "1.2"
            ? new Scorm12Adapter(m.api)
            : new Scorm2004Adapter(m.api),
        session = new ScormSessionManager(adapter, c, "abc");
      return { c, m, session };
    }
    it("reports incomplete and never completes an unmet mandatory competency", () => {
      const { c, m, session } = fixture();
      let s = visit(c, session.initialize(), 0);
      s = answerQuestion(c, s, "b");
      session.save(finishGame(c, s));
      expect(
        m.values[
          version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
        ],
      ).toBe("incomplete");
      expect(
        m.values[version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"],
      ).toBe("0");
      expect(s.life).toBe(75);
    });
    it("reports completion, scores, bookmarks and termination using version-specific fields", () => {
      const { c, m, session } = fixture();
      let s = visit(c, session.initialize(), 0);
      s = finishGame(c, answerQuestion(c, s, "a"));
      session.save(s);
      expect(
        m.values[
          version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
        ],
      ).toBe(version === "1.2" ? "passed" : "completed");
      if (version === "2004") {
        expect(m.values["cmi.success_status"]).toBe("passed");
        expect(m.values["cmi.score.scaled"]).toBe("1");
        expect(m.values["cmi.progress_measure"]).toBe("1");
      }
      expect(
        m.values[version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"],
      ).toBe("100");
      expect(
        m.values[
          version === "1.2" ? "cmi.core.lesson_location" : "cmi.location"
        ],
      ).toBe("0");
      session.terminate(s);
      session.terminate(s);
      expect(
        m.calls.filter(
          (x) => x === (version === "1.2" ? "Finish" : "Terminate"),
        ),
      ).toHaveLength(1);
    });
    it("resumes saved state and rejects mismatched packages", () => {
      const { c, m, session } = fixture();
      session.initialize();
      const s = answerQuestion(c, visit(c, initialGame(), 0), "b");
      session.save(s);
      m.values[version === "1.2" ? "cmi.core.entry" : "cmi.entry"] = "resume";
      const resumed = new ScormSessionManager(
        version === "1.2"
          ? new Scorm12Adapter(m.api)
          : new Scorm2004Adapter(m.api),
        c,
        "abc",
      );
      expect(resumed.initialize()).toEqual(s);
      m.values[
        version === "1.2" ? "cmi.core.lesson_location" : "cmi.location"
      ] = "99";
      const mismatched = new ScormSessionManager(
        version === "1.2"
          ? new Scorm12Adapter(m.api)
          : new Scorm2004Adapter(m.api),
        c,
        "abc",
      );
      expect(() => mismatched.initialize()).toThrow(/bookmark/);
      expect(() => mismatched.save(s)).toThrow(/not active/);

      expect(() =>
        ResumeStateSerializer.deserialize(
          m.values["cmi.suspend_data"],
          "other",
          1,
          1,
          version,
        ),
      ).toThrow();
    });
    it("surfaces failed writes without reporting completion", () => {
      const { m, session } = fixture();
      session.initialize();
      m.fail();
      expect(() => session.save(initialGame())).toThrow(/failed/);
      expect(
        m.values[
          version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
        ],
      ).toBeUndefined();
    });
    it("keeps maximal supported resume state within the actual version limit", () => {
      const count = version === "1.2" ? 1024 : 10000,
        list = Array.from({ length: count }, (_, i) => i),
        state = {
          ...initialGame(),
          visited: list,
          passed: list,
          penalized: list,
          recovered: list,
          stars: [0],
          completedLevels: [0],
        };
      const data = ResumeStateSerializer.serialize(
        state,
        "f".repeat(64),
        count,
        100,
        version,
      );
      expect(data.length).toBeLessThanOrEqual(version === "1.2" ? 4096 : 64000);
      expect(
        ResumeStateSerializer.deserialize(
          data,
          "f".repeat(64),
          count,
          100,
          version,
        ),
      ).toEqual(state);
    });
    it("rejects oversized and malformed suspend data", () => {
      expect(() =>
        ResumeStateSerializer.deserialize(
          "x".repeat(ResumeStateSerializer.limit(version) + 1),
          "a",
          1,
          1,
          version,
        ),
      ).toThrow();
      expect(() =>
        ResumeStateSerializer.deserialize("{}", "a", 1, 1, version),
      ).toThrow();
    });
  });
it("formats session times correctly", () => {
  expect(scorm12Time(3723450)).toBe("0001:02:03.45");
  expect(scorm2004Time(3723450)).toBe("PT3723.45S");
});
it("discovers APIs through parents and opener and handles unavailable/cross-origin ancestors", () => {
  const api = {};
  const parent = { API: api };
  Object.assign(parent, { parent });
  const child = { parent, opener: null };
  expect(discoverApi("1.2", child as unknown as Window)).toBe(api);
  const windowLike = { parent: null, opener: { API_1484_11: api } };
  Object.assign(windowLike, { parent: windowLike });
  expect(discoverApi("2004", windowLike as unknown as Window)).toBe(api);
  const denied = {
    get API() {
      throw new Error("Cross origin");
    },
    opener: null,
  };
  expect(discoverApi("1.2", denied as unknown as Window)).toBe(null);
});
for (const version of ["1.2", "2004"] as const)
  it(`${version} can report failed assessment only when completion competencies are satisfied`, () => {
    const c = newCourse("Optional assessment");
    c.levels[0].slides = [
      {
        ...newSlide("Optional question"),
        kind: "single-choice",
        mandatory: false,
      },
    ];
    const m = mock(version),
      session = new ScormSessionManager(
        version === "1.2"
          ? new Scorm12Adapter(m.api)
          : new Scorm2004Adapter(m.api),
        c,
        "failed-fixture",
      );
    let s = visit(c, session.initialize(), 0);
    s = finishGame(c, answerQuestion(c, s, "b"));
    session.save(s);
    expect(
      m.values[
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.success_status"
      ],
    ).toBe("failed");
    if (version === "2004")
      expect(m.values["cmi.completion_status"]).toBe("completed");
  });
for (const version of ["1.2", "2004"] as const) {
  it(`${version} surfaces failed commit and can retry the same canonical state`, () => {
    const c = newCourse("Commit failure"),
      m = mock(version),
      commit = version === "1.2" ? "LMSCommit" : "Commit";
    m.api[commit] = () => "false";
    const session = new ScormSessionManager(
      version === "1.2"
        ? new Scorm12Adapter(m.api)
        : new Scorm2004Adapter(m.api),
      c,
      "commit-failure",
    );
    session.initialize();
    const state = visit(c, initialGame(), 0);
    expect(() => session.save(state)).toThrow(/failed/);
    expect(state.life).toBe(100);
    m.api[commit] = () => "true";
    expect(() => session.save(state)).not.toThrow();
  });
  it(`${version} rejects a failed initialization`, () => {
    const m = mock(version);
    m.api[version === "1.2" ? "LMSInitialize" : "Initialize"] = () => "false";
    const session = new ScormSessionManager(
      version === "1.2"
        ? new Scorm12Adapter(m.api)
        : new Scorm2004Adapter(m.api),
      newCourse("Init failure"),
      "init-failure",
    );
    expect(() => session.initialize()).toThrow(/failed/);
    expect(() => session.save(initialGame())).toThrow(/not active/);
  });
}
for (const element of ["cmi.location", "cmi.suspend_data"])
  it(`2004 treats uninitialized ${element} (403) as empty`, () => {
    const api: ScormApi = { GetValue: () => "", GetLastError: () => "403" };
    expect(new Scorm2004Adapter(api).get(element)).toBe("");
  });
for (const [version, element, value, code] of [
  ["1.2", "cmi.core.lesson_location", "", "403"],
  ["2004", "cmi.location", "", "401"],
  ["2004", "cmi.entry", "", "403"],
  ["2004", "cmi.location", "unexpected-value", "403"],
] as const)
  it(`${version} retains real LMS errors for ${element}, ${code}, ${value || "empty"}`, () => {
    const api: ScormApi = {
      [version === "1.2" ? "LMSGetValue" : "GetValue"]: () => value,
      [version === "1.2" ? "LMSGetLastError" : "GetLastError"]: () => code,
    };
    const adapter =
      version === "1.2" ? new Scorm12Adapter(api) : new Scorm2004Adapter(api);
    expect(() => adapter.get(element)).toThrow(`code ${code}`);
  });
for (const version of ["1.2", "2004"] as const)
  it(`${version} fresh launch does not read uninitialized resume-only values`, () => {
    const m = mock(version),
      get = version === "1.2" ? "LMSGetValue" : "GetValue";
    m.api[get] = (element) => {
      if (element === (version === "1.2" ? "cmi.core.entry" : "cmi.entry"))
        return "ab-initio";
      throw new Error("Unexpected resume read");
    };
    const session = new ScormSessionManager(
      version === "1.2"
        ? new Scorm12Adapter(m.api)
        : new Scorm2004Adapter(m.api),
      newCourse("Fresh launch"),
      "fresh",
    );
    expect(session.initialize()).toEqual(initialGame());
  });
for (const version of ["1.2", "2004"] as const) {
  it(`${version} reopening a completed normal-entry registration retains the result read-only`, () => {
    const c = newCourse("Completed review");
    c.levels[0].slides = [{ ...newSlide("Question"), kind: "single-choice" }];
    const state = finishGame(
        c,
        answerQuestion(c, visit(c, initialGame(), 0), "a"),
      ),
      m = mock(version);
    m.values[version === "1.2" ? "cmi.core.entry" : "cmi.entry"] = "";
    m.values[
      version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
    ] = version === "1.2" ? "passed" : "completed";
    m.values[version === "1.2" ? "cmi.core.lesson_location" : "cmi.location"] =
      "0";
    m.values["cmi.suspend_data"] = ResumeStateSerializer.serialize(
      state,
      "review",
      1,
      1,
      version,
    );
    const session = new ScormSessionManager(
      version === "1.2"
        ? new Scorm12Adapter(m.api)
        : new Scorm2004Adapter(m.api),
      c,
      "review",
    );
    expect(session.initialize()).toEqual(state);
    session.save(state);
    expect(m.calls.filter((c) => c.startsWith("cmi."))).toEqual([]);
    session.terminate(state);
    expect(
      m.values[
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
      ],
    ).toBe(version === "1.2" ? "passed" : "completed");
  });
  it(`${version} failed resume initialization terminates the opened API without writing progress`, () => {
    const m = mock(version);
    m.values[version === "1.2" ? "cmi.core.entry" : "cmi.entry"] = "resume";
    m.values["cmi.suspend_data"] = "corrupt-state";
    const session = new ScormSessionManager(
      version === "1.2"
        ? new Scorm12Adapter(m.api)
        : new Scorm2004Adapter(m.api),
      newCourse("Corrupt resume"),
      "corrupt",
    );
    expect(() => session.initialize()).toThrow();
    expect(m.calls).toContain(version === "1.2" ? "Finish" : "Terminate");
    expect(m.calls.filter((c) => c.startsWith("cmi."))).toEqual([]);
  });
}
for (const version of ["1.2", "2004"] as const)
  it(`${version} rejects a forged finished resume that lacks mandatory competencies`, () => {
    const c = newCourse("Mandatory");
    c.levels[0].slides = [{ ...newSlide("Required"), kind: "single-choice" }];
    const m = mock(version);
    m.values[version === "1.2" ? "cmi.core.entry" : "cmi.entry"] = "resume";
    m.values["cmi.suspend_data"] = ResumeStateSerializer.serialize(
      { ...initialGame(), visited: [0], finished: true },
      "mandatory",
      1,
      1,
      version,
    );
    const session = new ScormSessionManager(
      version === "1.2"
        ? new Scorm12Adapter(m.api)
        : new Scorm2004Adapter(m.api),
      c,
      "mandatory",
    );
    expect(() => session.initialize()).toThrow(/mandatory competency/);
    expect(m.calls.filter((c) => c.startsWith("cmi."))).toEqual([]);
  });
it("2004 reports passed assessment independently of incomplete course navigation", () => {
  const c = demoCourseForAssessment();
  const m = mock("2004"),
    session = new ScormSessionManager(
      new Scorm2004Adapter(m.api),
      c,
      "separate",
    );
  let state = visit(c, session.initialize(), 0);
  state = answerQuestion(c, state, "b");
  session.save(state);
  expect(m.values["cmi.success_status"]).toBe("failed");
  state = answerQuestion(c, state, "a");
  session.save(state);
  expect(m.values["cmi.score.raw"]).toBe("100");
  expect(m.values["cmi.success_status"]).toBe("passed");
  expect(m.values["cmi.completion_status"]).toBe("incomplete");
});
function demoCourseForAssessment() {
  const c = newCourse("Separate assessment");
  c.levels[0].slides = [
    { ...newSlide("Quiz"), kind: "single-choice" },
    newSlide("Unvisited mandatory content"),
  ];
  return c;
}

import { describe, it, expect } from "vitest";
import { Scorm2004API } from "scorm-again/scorm2004";
import { Scorm2004Adapter } from "../src/lib/scorm/adapters";
import { ScormSessionManager } from "../src/lib/scorm/session";
import { demoCourse } from "../src/lib/course";
import { visit, answerQuestion, finishGame } from "../src/lib/game";
import type { ScormApi } from "../src/lib/scorm/types";
function lms() {
  const api = new Scorm2004API({ logLevel: 5, autocommit: false });
  api.cmi.entry = "ab-initio";
  return api;
}
describe("independent SCORM 2004 runtime regression (scorm-again, not SCORM Cloud)", () => {
  it("reproduces the actual uninitialized bookmark error 403", () => {
    const api = lms();
    expect(api.Initialize("")).toBe("true");
    expect(api.GetValue("cmi.location")).toBe("");
    expect(String(api.GetLastError())).toBe("403");
    expect(api.Terminate("")).toBe("true");
  });
  it("fresh launch commits incomplete, zero score and progress; mandatory completion then commits passed", () => {
    const api = lms(),
      course = demoCourse(),
      manager = new ScormSessionManager(
        new Scorm2004Adapter(api as unknown as ScormApi),
        course,
        "independent-runtime",
      );
    let state = visit(course, manager.initialize(), 0);
    manager.save(state);
    expect(api.GetValue("cmi.completion_status")).toBe("incomplete");
    expect(api.GetValue("cmi.success_status")).toBe("unknown");
    expect(api.GetValue("cmi.score.raw")).toBe("0");
    expect(Number(api.GetValue("cmi.progress_measure"))).toBeGreaterThan(0);
    state = visit(course, state, 2);
    state = answerQuestion(course, state, "b");
    manager.save(state);
    expect(state.life).toBe(75);
    expect(api.GetValue("cmi.completion_status")).toBe("incomplete");
    state = answerQuestion(course, state, "a");
    state = visit(course, state, 1);
    state = finishGame(course, state);
    manager.save(state);
    expect(api.GetValue("cmi.completion_status")).toBe("completed");
    expect(api.GetValue("cmi.success_status")).toBe("passed");
    expect(api.GetValue("cmi.score.raw")).toBe("100");
    expect(api.GetValue("cmi.score.scaled")).toBe("1");
    manager.terminate(state);
  });
});

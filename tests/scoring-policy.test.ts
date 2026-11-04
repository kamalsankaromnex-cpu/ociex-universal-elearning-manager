import { describe, expect, it } from "vitest";
import {
  assessment,
  answerQuestion,
  finishGame,
  initialGame,
  visit,
} from "../src/lib/game";
import { newCourse, newSlide } from "../src/lib/course";
import { acceptanceSchema } from "../src/lib/publishing/acceptance";
import { ExportValidator } from "../src/lib/publishing/validator";
function fixture() {
  const c = newCourse("Policy");
  c.rules = { penalty: 25, recovery: 25, passScore: 80 };
  c.levels[0].slides = [
    { ...newSlide("Required"), kind: "single-choice" },
    { ...newSlide("Optional"), kind: "single-choice", mandatory: false },
    { ...newSlide("Unscored required"), kind: "single-choice", scored: false },
  ];
  let s = answerQuestion(c, visit(c, initialGame(), 0), "a");
  s = visit(c, s, 1);
  s = answerQuestion(c, visit(c, s, 2), "a");
  return { c, s };
}
describe("explicit scoring policies", () => {
  it("preserves legacy optional/unanswered zero scoring and excludes unscored questions", () => {
    const { c, s } = fixture();
    expect(assessment(c, s)).toMatchObject({
      score: 50,
      eligible: true,
      success: false,
    });
  });
  it("can exclude optional questions without bypassing mandatory competency", () => {
    const { c, s } = fixture();
    c.rules!.optionalScoring = "exclude";
    expect(assessment(c, s).score).toBe(100);
    expect(assessment(c, { ...s, passed: [0] }).eligible).toBe(false);
  });
  it("can exclude unanswered optional questions but counts a submitted wrong answer", () => {
    const { c, s } = fixture();
    c.rules!.unansweredScoring = "exclude-optional";
    expect(assessment(c, s).score).toBe(100);
    const wrong = answerQuestion(c, visit(c, s, 1), "b");
    expect(assessment(c, wrong).score).toBe(50);
  });
  it("uses configurable passing score and best-correct mastery independent of life", () => {
    const { c, s } = fixture();
    c.rules!.passScore = 50;
    expect(assessment(c, s).success).toBe(true);
    const wrong = answerQuestion(c, visit(c, s, 1), "b");
    const corrected = answerQuestion(c, wrong, "a");
    expect(corrected.life).toBe(75);
    expect(assessment(c, corrected).score).toBe(100);
  });
  it("never finishes with an unmet mandatory unscored question", () => {
    const { c, s } = fixture();
    expect(finishGame(c, { ...s, passed: [0] }).finished).toBe(false);
  });
  it("defines no scored questions as 100 while still enforcing completion", () => {
    const { c, s } = fixture();
    for (const slide of c.levels[0].slides) slide.scored = false;
    expect(assessment(c, s).score).toBe(100);
    expect(assessment(c, { ...s, passed: [] }).eligible).toBe(false);
  });
});
describe("publishing validation", () => {
  const request = {
    revision: 1,
    version: "2004" as const,
    scope: "course" as const,
  };
  it("rejects missing embedded assets and masquerading image payloads", () => {
    const c = newCourse("Assets");
    c.levels[0].slides[0].image = "assets/media/" + "a".repeat(64) + ".png";
    expect(new ExportValidator().validate(c, request).errors).toContain(
      "Re-upload missing media before exporting.",
    );
    c.levels[0].slides[0].image =
      "data:image/png;base64,QUFBQUFBQUFBQUFBQUFBQQ==";
    expect(new ExportValidator().validate(c, request).errors.join()).toMatch(
      /image type/,
    );
  });
  it("rejects blank prompts, missing correct answers and invalid passing settings", () => {
    const { c } = fixture();
    c.levels[0].slides[0].text = " ";
    expect(new ExportValidator().validate(c, request).errors.join()).toMatch(
      /prompt/,
    );
    c.rules!.passScore = 101;
    expect(
      new ExportValidator().validate(c, request).errors.length,
    ).toBeGreaterThan(0);
  });
});
describe("LMS acceptance evidence", () => {
  const base = {
    platform: "SCORM Cloud",
    edition: "2004",
    testedVersion: "hosted build 1",
    tester: "Tester",
    testedAt: "2026-11-04T00:00:00Z",
    result: "passed",
    evidence:
      "Imported, launched and reviewed the runtime and sequencing debug logs.",
    importVerified: true,
    launchVerified: true,
    debugVerified: true,
  };
  it("requires actual import, launch and debug verification for a reported pass", () => {
    expect(acceptanceSchema.safeParse(base).success).toBe(true);
    for (const key of ["importVerified", "launchVerified", "debugVerified"])
      expect(
        acceptanceSchema.safeParse({ ...base, [key]: false }).success,
      ).toBe(false);
  });
  it("rejects empty evidence and future test dates", () => {
    expect(acceptanceSchema.safeParse({ ...base, evidence: "" }).success).toBe(
      false,
    );
    expect(
      acceptanceSchema.safeParse({ ...base, testedAt: "2099-01-01T00:00:00Z" })
        .success,
    ).toBe(false);
  });
  it("allows explicitly unverified results without suggesting a pass", () => {
    expect(
      acceptanceSchema.safeParse({
        ...base,
        result: "unverified",
        importVerified: false,
        launchVerified: false,
        debugVerified: false,
      }).success,
    ).toBe(true);
  });
});

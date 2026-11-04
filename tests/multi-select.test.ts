import { describe, expect, it } from "vitest";
import { courseSchema, demoCourse } from "../src/lib/course";
import { machineGuardingCourse } from "../src/lib/machine-guarding-sample";
import { normalizeSubmission } from "../src/lib/interactions";
import {
  answerQuestion,
  assessment,
  finishGame,
  initialGame,
  retryLevel,
  submitQuestion,
  validateMultiResume,
  visit,
} from "../src/lib/game";
import { ResumeStateSerializer } from "../src/lib/scorm/resume";
import { ExportValidator } from "../src/lib/publishing/validator";
function fixture() {
  const c = machineGuardingCourse();
  return { c, slide: c.levels[0].slides[0], s: visit(c, initialGame(), 0) };
}
describe("multi-select normalization", () => {
  it("accepts one correct answer or several correct answers with order-independent exact matching", () => {
    const { slide } = fixture();
    expect(normalizeSubmission(slide, ["b", "a"])).toMatchObject({
      credit: 10000,
      correct: true,
      selection: 3,
    });
    slide.correctIds = ["b"];
    expect(normalizeSubmission(slide, ["b"])).toMatchObject({
      credit: 10000,
      correct: true,
    });
  });
  it.each([
    [["a"], 5000],
    [["a", "b", "c"], 5000],
    [["c"], 0],
    [["a", "c"], 0],
    [["a", "b", "c", "d"], 0],
  ] as const)("partial credit for %j is %i basis points", (ids, credit) => {
    const { slide } = fixture();
    expect(normalizeSubmission(slide, ids)?.credit).toBe(credit);
  });
  it("all-or-nothing rejects partial and extra selections without partial credit", () => {
    const { slide } = fixture();
    slide.scoringMode = "all-or-nothing";
    expect(normalizeSubmission(slide, ["a"])?.credit).toBe(0);
    expect(normalizeSubmission(slide, ["a", "b", "c"])?.credit).toBe(0);
    expect(normalizeSubmission(slide, ["a", "b"])?.credit).toBe(10000);
  });
  it("treats an omitted scoring setting as all-or-nothing", () => {
    const { slide } = fixture();
    delete slide.scoringMode;
    expect(normalizeSubmission(slide, ["a"])?.credit).toBe(0);
  });
  it("ignores empty and unknown submissions and normalizes duplicate IDs without free credit", () => {
    const { slide } = fixture();
    expect(normalizeSubmission(slide, [])).toBeNull();
    expect(normalizeSubmission(slide, ["missing"])).toBeNull();
    expect(normalizeSubmission(slide, ["a", "a"])?.credit).toBe(5000);
  });
  it("preserves answer key meaning when options are reordered", () => {
    const { slide } = fixture();
    slide.options.reverse();
    expect(normalizeSubmission(slide, ["a", "b"])).toMatchObject({
      correct: true,
      credit: 10000,
      selection: 12,
    });
  });
});
describe("shared engine", () => {
  it("applies one normalized result and penalizes repeated or changed non-exact submissions at most once", () => {
    const { c, slide, s } = fixture();
    const first = submitQuestion(c, s, normalizeSubmission(slide, ["a"]));
    expect(first.life).toBe(75);
    expect(assessment(c, first).score).toBe(50);
    expect(submitQuestion(c, first, normalizeSubmission(slide, ["a"]))).toBe(
      first,
    );
    const other = submitQuestion(c, first, normalizeSubmission(slide, ["c"]));
    expect(other.life).toBe(75);
    expect(other.multi?.[0]).toEqual({ selection: 4, credit: 5000 });
  });
  it("does not complete mandatory competencies with partial credit even at a passing threshold", () => {
    const { c, slide, s } = fixture();
    c.rules = { penalty: 25, recovery: 25, passScore: 40 };
    const partial = submitQuestion(c, s, normalizeSubmission(slide, ["a"]));
    expect(assessment(c, partial)).toMatchObject({
      score: 50,
      success: true,
      eligible: false,
    });
    expect(finishGame(c, partial).finished).toBe(false);
    const exact = submitQuestion(
      c,
      partial,
      normalizeSubmission(slide, ["a", "b"]),
    );
    expect(finishGame(c, exact).finished).toBe(true);
    expect(exact.life).toBe(75);
  });
  it("reports partial credit for optional questions and obeys scored/unscored policies", () => {
    const { c, slide, s } = fixture();
    slide.mandatory = false;
    const state = submitQuestion(c, s, normalizeSubmission(slide, ["a"]));
    expect(finishGame(c, state).finished).toBe(true);
    expect(assessment(c, state).score).toBe(50);
    slide.scored = false;
    expect(assessment(c, state).score).toBe(100);
    slide.mandatory = true;
    expect(assessment(c, state).eligible).toBe(false);
  });
  it("rejects empty, forged and mismatched results without life or credit changes", () => {
    const { c, slide, s } = fixture();
    expect(submitQuestion(c, s, normalizeSubmission(slide, []))).toBe(s);
    const partial = normalizeSubmission(slide, ["a"])!;
    expect(submitQuestion(c, s, { ...partial, credit: 10000 })).toBe(s);
    expect(submitQuestion(c, s, { ...partial, slideId: "wrong" })).toBe(s);
  });
  it("keeps finished results immutable and resets only the retried level's multi-select state", () => {
    const { c, slide, s } = fixture();
    let state = submitQuestion(c, s, normalizeSubmission(slide, ["a", "b"]));
    state = finishGame(c, state);
    expect(submitQuestion(c, state, normalizeSubmission(slide, ["c"]))).toBe(
      state,
    );
    const second = { ...slide, id: "second-question" };
    c.levels.push({ id: "second-level", title: "Second", slides: [second] });
    let resumed = { ...state, finished: false };
    resumed = visit(c, resumed, 1);
    resumed = submitQuestion(c, resumed, normalizeSubmission(second, ["c"]));
    const retried = retryLevel(c, resumed);
    expect(retried.multi?.[0]?.credit).toBe(10000);
    expect(retried.multi?.[1]).toBeUndefined();
    expect(retried.stars).toEqual([0]);
  });
  it("keeps existing single-choice behavior and course documents unchanged", () => {
    const c = demoCourse();
    expect(courseSchema.parse(c)).toEqual(c);
    let s = visit(c, initialGame(), 2);
    s = answerQuestion(c, s, "b");
    expect(s.life).toBe(75);
    expect(s.multi).toBeUndefined();
    expect(answerQuestion(c, s, "b")).toBe(s);
    s = answerQuestion(c, s, "a");
    expect(s.passed).toContain(2);
  });
});
describe("course validation", () => {
  it("validates correct IDs, uniqueness, scoring mode, option counts and image alternative text", () => {
    const { c, slide } = fixture();
    expect(courseSchema.safeParse(c).success).toBe(true);
    for (const correctIds of [[], ["missing"], ["a", "a"]])
      expect(
        courseSchema.safeParse({
          ...c,
          levels: [{ ...c.levels[0], slides: [{ ...slide, correctIds }] }],
        }).success,
      ).toBe(false);
    slide.options[0].image = "data:image/png;base64,aGVsbG8=";
    expect(courseSchema.safeParse(c).success).toBe(false);
    slide.options[0].imageAlt = "Barrier illustration";
    expect(courseSchema.safeParse(c).success).toBe(true);
  });
  it("requires a prompt and rejects broken answer-image payloads before export", () => {
    const { c, slide } = fixture();
    slide.text = "";
    expect(
      new ExportValidator()
        .validate(c, { revision: 1, version: "2004", scope: "course" })
        .errors.join(),
    ).toMatch(/prompt/);
    slide.text = "Prompt";
    slide.options[0].image = "data:image/png;base64,aGVsbG8=";
    slide.options[0].imageAlt = "Illustration";
    expect(
      new ExportValidator()
        .validate(c, { revision: 1, version: "2004", scope: "course" })
        .errors.join(),
    ).toMatch(/image type/);
  });
});
for (const version of ["1.2", "2004"] as const)
  describe(`${version} compact multi-select resume`, () => {
    it("round-trips selected options, best partial credit and the one-time penalty", () => {
      const { c, slide, s } = fixture();
      const answered = submitQuestion(c, s, normalizeSubmission(slide, ["a"]));
      const data = ResumeStateSerializer.serialize(
        answered,
        "multi",
        1,
        1,
        version,
      );
      expect(JSON.parse(data)[0]).toBe(2);
      const restored = ResumeStateSerializer.deserialize(
        data,
        "multi",
        1,
        1,
        version,
      );
      expect(restored).toEqual(answered);
      expect(() => validateMultiResume(c, restored)).not.toThrow();
      expect(
        submitQuestion(c, restored, normalizeSubmission(slide, ["a"])),
      ).toEqual(restored);
    });
    it("still reads/writes legacy v1 state without adding new fields", () => {
      const state = initialGame();
      const text = ResumeStateSerializer.serialize(state, "old", 3, 1, version);
      expect(JSON.parse(text)[0]).toBe(1);
      expect(
        ResumeStateSerializer.deserialize(text, "old", 3, 1, version),
      ).toEqual(state);
    });
    it("rejects malformed records, duplicate indices, out-of-range masks and invalid credit", () => {
      const { c, slide, s } = fixture();
      const state = submitQuestion(c, s, normalizeSubmission(slide, ["a"]));
      const payload = JSON.parse(
        ResumeStateSerializer.serialize(state, "multi", 1, 1, version),
      );
      for (const entries of [
        [0, 64, 5000],
        [0, 1, 10001],
        [0, 1, 5000, 0, 1, 5000],
        [1, 1, 5000],
      ])
        expect(() =>
          ResumeStateSerializer.deserialize(
            JSON.stringify([...payload.slice(0, 12), entries]),
            "multi",
            1,
            1,
            version,
          ),
        ).toThrow();
      expect(() =>
        validateMultiResume(c, {
          ...state,
          multi: { 0: { selection: 1, credit: 3333 } },
        }),
      ).toThrow();
      expect(() =>
        validateMultiResume(c, { ...state, multi: undefined }),
      ).toThrow();
    });
    it("validates worst-case resume capacity before publication", () => {
      const { c, slide } = fixture();
      for (let l = 0; l < 10; l++)
        c.levels.push({
          id: `level-${l}`,
          title: `Level ${l}`,
          slides: Array.from({ length: 100 }, (_, i) => ({
            ...slide,
            id: `multi-${l}-${i}`,
          })),
        });
      const validation = new ExportValidator().validate(c, {
        revision: 1,
        version,
        scope: "course",
      });
      if (version === "1.2")
        expect(validation.errors.join()).toMatch(/Resume data exceeds/);
      else expect(validation.errors).toEqual([]);
    });
  });

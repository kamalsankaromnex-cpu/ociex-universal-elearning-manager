import { describe, expect, it } from "vitest";
import { courseSchema, newCourse, newSlide } from "../src/lib/course";
import { compositionSchema } from "../src/lib/composer/schema";
import {
  composerSlide,
  composerDemoCourse,
  demoQuestion,
} from "../src/lib/composer/sample";
import {
  composerContext,
  convertSlide,
  duplicateSlide,
  newBlock,
  questionSlide,
} from "../src/lib/composer/model";
import {
  composerComplete,
  canNavigate,
  validateComposerResume,
} from "../src/lib/composer/runtime";
import {
  initialGame,
  visit,
  activateBlock,
  submitQuestion,
  retryActivity,
  retryLevel,
  assessment,
  finishGame,
  dismissFeedback,
} from "../src/lib/game";
import { normalizeSubmission } from "../src/lib/interactions";
import { ResumeStateSerializer } from "../src/lib/scorm/resume";
import { ExportValidator } from "../src/lib/publishing/validator";
function submit(
  c: ReturnType<typeof newCourse>,
  s: ReturnType<typeof initialGame>,
  id: string,
  ids: string[],
) {
  const slide = c.levels.flatMap((l) => l.slides)[s.index];
  const b = slide.composition!.blocks.find((b) => b.id === id);
  if (b?.kind !== "interaction") throw Error("Question missing");
  return submitQuestion(
    c,
    s,
    normalizeSubmission(questionSlide(slide, b), ids),
  );
}
describe("versioned schema and migration", () => {
  it("validates ordered blocks, regions, independent feedback and a minimal composed JSON envelope", () => {
    const c = composerDemoCourse();
    expect(courseSchema.safeParse(c).success).toBe(true);
    const minimal = {
      ...c,
      levels: [
        {
          ...c.levels[0],
          slides: [
            {
              id: "minimal",
              title: "Minimal",
              kind: "composed",
              composition: c.levels[0].slides[0].composition,
            },
          ],
        },
      ],
    };
    expect(courseSchema.safeParse(minimal).success).toBe(true);
  });
  it("converts legacy fields explicitly, preserving inherited rules, feedback and stable IDs", () => {
    const old = {
      ...newSlide("Question"),
      kind: "single-choice" as const,
      image: "",
    };
    const converted = convertSlide(old, {
      penalty: 40,
      recovery: 10,
      passScore: 70,
    });
    expect(old.kind).toBe("single-choice");
    expect(
      converted.composition!.blocks.find((b) => b.kind === "interaction"),
    ).toMatchObject({ question: { lifePenalty: 40 } });
    expect(convertSlide(converted)).toBe(converted);
    expect(
      converted.composition!.blocks.filter((b) => b.kind === "feedback"),
    ).toHaveLength(4);
  });
  it("remaps IDs and feedback/rules when a composed slide is duplicated", () => {
    const slide = composerDemoCourse().levels[0].slides[1],
      copy = duplicateSlide(slide);
    expect(copy.id).not.toBe(slide.id);
    expect(
      copy.composition!.blocks.some((b) =>
        slide.composition!.blocks.some((old) => old.id === b.id),
      ),
    ).toBe(false);
    expect(compositionSchema.safeParse(copy.composition).success).toBe(true);
  });
  it.each(["columns", "left-wide", "right-wide"] as const)(
    "supports the %s layout without imposing content order",
    (variant) => {
      const slide = composerDemoCourse().levels[0].slides[1];
      slide.composition!.layout.variant = variant;
      expect(compositionSchema.safeParse(slide.composition).success).toBe(true);
      slide.composition!.blocks.reverse();
      expect(compositionSchema.safeParse(slide.composition).success).toBe(true);
    },
  );
});
describe("rule safety validation", () => {
  it("rejects missing references, feedback ownership/layer errors and unknown versions", () => {
    const c = composerDemoCourse();
    const slide = c.levels[0].slides[1],
      composition = slide.composition!;
    for (const patch of [
      { version: 2 },
      { layout: { variant: "columns", regions: ["left"] } },
      {
        completion: {
          mode: "activities",
          required: true,
          interactionIds: ["missing"],
        },
      },
    ])
      expect(
        compositionSchema.safeParse({ ...composition, ...patch }).success,
      ).toBe(false);
    const f = composition.blocks.find((b) => b.kind === "feedback")!;
    expect(
      compositionSchema.safeParse({
        ...composition,
        blocks: composition.blocks.map((b) =>
          b.id === f.id ? { ...b, interactionId: "missing" } : b,
        ),
      }).success,
    ).toBe(false);
  });
  it("rejects self-dependent hidden mandatory activities and hidden completion controls", () => {
    const c = composerDemoCourse();
    const s = c.levels[0].slides[1];
    s.composition!.rules = [];
    expect(compositionSchema.safeParse(s.composition).success).toBe(false);
    const first = c.levels[0].slides[0];
    first.composition!.blocks = first.composition!.blocks.map((b) =>
      b.kind === "button" ? { ...b, visible: false } : b,
    );
    expect(compositionSchema.safeParse(first.composition).success).toBe(false);
  });
  it("rejects hiding event sources, invalid scoring actions and impossible partial triggers", () => {
    const comp = composerDemoCourse().levels[0].slides[1].composition!;
    for (const action of [
      { type: "hide", targetId: "mixed:first" },
      { type: "record-result", targetId: "mixed:second" },
    ])
      expect(
        compositionSchema.safeParse({
          ...comp,
          rules: [{ ...comp.rules[0], actions: [action] }],
        }).success,
      ).toBe(false);
    expect(
      compositionSchema.safeParse({
        ...comp,
        rules: [
          ...comp.rules,
          {
            id: "invalid-partial",
            trigger: { event: "partial", sourceId: "mixed:first" },
            actions: [{ type: "show", targetId: "mixed:after" }],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("rejects self/back navigation, broken destinations and enter-triggered navigation", () => {
    for (const target of ["composer:intro", "missing"]) {
      const c = composerDemoCourse();
      c.levels[0].slides[0].composition!.rules.push({
        id: "nav",
        trigger: { event: "activate", sourceId: "intro:complete" },
        actions: [{ type: "navigate", slideId: target }],
      });
      expect(courseSchema.safeParse(c).success).toBe(false);
    }
    const c = composerDemoCourse();
    c.levels[0].slides[0].composition!.rules.push({
      id: "nav",
      trigger: { event: "enter" },
      actions: [{ type: "navigate", slideId: "composer:mixed" }],
    });
    expect(courseSchema.safeParse(c).success).toBe(false);
  });
  it("rejects unsupported scripting/recursive triggers and unsafe block identifiers", () => {
    const comp = composerDemoCourse().levels[0].slides[0].composition!;
    expect(
      compositionSchema.safeParse({
        ...comp,
        rules: [
          {
            id: "script",
            trigger: { event: "reveal", sourceId: "intro:reveal" },
            actions: [{ type: "javascript", code: "while(true){}" }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      compositionSchema.safeParse({
        ...comp,
        blocks: comp.blocks.map((b, i) =>
          i === 0 ? { ...b, id: "__proto__" } : b,
        ),
      }).success,
    ).toBe(false);
  });
});
describe("content, completion and independent runtime", () => {
  it("completes content-only and media-only slides without a question", () => {
    const c = newCourse("Content");
    c.levels[0].slides = [
      composerSlide("Text", "text", [
        {
          ...newBlock("content"),
          id: "text-block",
          kind: "content",
          text: "Content",
        },
      ]),
    ];
    let s = visit(c, initialGame(), 0);
    expect(assessment(c, s).eligible).toBe(true);
    expect(finishGame(c, s).finished).toBe(true);
    c.levels[0].slides = [
      composerSlide("Media", "media", [
        {
          ...newBlock("media"),
          id: "image",
          kind: "media",
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHyQAAAAASUVORK5CYII=",
          alt: "Illustration",
        },
      ]),
    ];
    s = visit(c, initialGame(), 0);
    expect(assessment(c, s).eligible).toBe(true);
  });
  it("gates content-only manual completion on revealed required content", () => {
    const c = composerDemoCourse();
    let s = visit(c, initialGame(), 0);
    expect(canNavigate(c, s, 1)).toBe(false);
    s = activateBlock(c, s, "intro:complete");
    expect(composerComplete(c.levels[0].slides[0], s, 0)).toBe(false);
    s = activateBlock(c, s, "intro:reveal");
    expect(composerComplete(c.levels[0].slides[0], s, 0)).toBe(true);
    expect(canNavigate(c, s, 1)).toBe(true);
  });
  it("tracks two interactions, feedback and one-time life penalties independently", () => {
    const c = composerDemoCourse();
    let s = visit(c, initialGame(), 0);
    s = activateBlock(c, s, "intro:reveal");
    s = activateBlock(c, s, "intro:complete");
    s = visit(c, s, 1);
    expect(submit(c, s, "mixed:second", ["a"])).toEqual(s);
    s = submit(c, s, "mixed:first", ["b"]);
    expect(s.life).toBe(75);
    s = submit(c, s, "mixed:first", ["b"]);
    expect(s.life).toBe(75);
    s = retryActivity(c, s, "mixed:first");
    expect(s.composer!.feedback).toContain("mixed:first-retry");
    s = submit(c, s, "mixed:first", ["a"]);
    s = submit(c, s, "mixed:second", ["a"]);
    expect(s.life).toBe(50);
    expect(assessment(c, s).score).toBe(75);
    expect(s.composer!.feedback).toContain("mixed:first-correct");
    expect(s.composer!.feedback).toContain("mixed:second-partial");
    expect(canNavigate(c, s, 2)).toBe(false);
    s = submit(c, s, "mixed:second", ["a", "b"]);
    expect(canNavigate(c, s, 2)).toBe(true);
    expect(assessment(c, s)).toMatchObject({ eligible: true, score: 100 });
  });
  it("does not award scores for empty/forged submissions and completion actions cannot bypass activities", () => {
    const c = composerDemoCourse();
    let s = visit(c, initialGame(), 0);
    s = activateBlock(c, s, "intro:reveal");
    s = activateBlock(c, s, "intro:complete");
    s = visit(c, s, 1);
    expect(submit(c, s, "mixed:first", [])).toEqual(s);
    expect(finishGame(c, s).finished).toBe(false);
    const q = c.levels[0].slides[1].composition!.blocks.find(
      (b) => b.id === "mixed:first",
    )!;
    if (q.kind !== "interaction") throw Error();
    const result = normalizeSubmission(
      questionSlide(c.levels[0].slides[1], q),
      ["b"],
    )!;
    expect(submitQuestion(c, s, { ...result, credit: 10000 })).toEqual(s);
  });
  it("preserves state on re-entry, dismisses independent feedback and clears only the retried level", () => {
    const c = composerDemoCourse();
    let s = visit(c, initialGame(), 0);
    s = activateBlock(c, s, "intro:reveal");
    s = activateBlock(c, s, "intro:complete");
    s = visit(c, s, 1);
    s = submit(c, s, "mixed:first", ["a"]);
    s = submit(c, s, "mixed:second", ["a"]);
    const old = s.composer!.answers;
    s = visit(c, s, 0);
    s = visit(c, s, 1);
    expect(s.composer!.answers).toEqual(old);
    s = dismissFeedback(s, "mixed:second-partial");
    expect(s.composer!.feedback).toContain("mixed:first-correct");
    expect(s.composer!.feedback).not.toContain("mixed:second-partial");
    s = retryLevel(c, s);
    expect(s.composer!.answers).toEqual({});
    expect(s.composer!.manual).toEqual([]);
  });
  it("supports optional unscored activities without changing score or blocking completion", () => {
    const c = newCourse("Optional");
    const q = demoQuestion("optional-q", "Optional");
    q.question.mandatory = false;
    q.question.scored = false;
    q.question.lifePenalty = 0;
    c.levels[0].slides = [
      composerSlide("Practice", "optional-slide", [q], {
        completion: { mode: "view", required: false, interactionIds: [] },
      }),
    ];
    let s = visit(c, initialGame(), 0);
    s = submit(c, s, q.id, ["b"]);
    expect(assessment(c, s)).toMatchObject({ eligible: true, score: 100 });
  });
  it("supports interaction-only slides and explicit forward navigation actions", () => {
    const c = newCourse("Question");
    const q = demoQuestion("only-q", "Question only");
    c.levels[0].slides = [
      composerSlide("Q", "only-slide", [q], {
        rules: [
          {
            id: "next-rule",
            trigger: { event: "correct", sourceId: q.id },
            actions: [{ type: "navigate", slideId: "last-slide" }],
          },
        ],
      }),
      { ...newSlide("Last"), id: "last-slide" },
    ];
    expect(courseSchema.safeParse(c).success).toBe(true);
    let s = visit(c, initialGame(), 0);
    s = submit(c, s, q.id, ["a"]);
    expect(s.index).toBe(1);
  });
});
for (const version of ["1.2", "2004"] as const)
  describe(`${version} composer resume`, () => {
    it("round-trips independent questions, visibility, manual completion and feedback in v3", () => {
      const c = composerDemoCourse();
      let s = visit(c, initialGame(), 0);
      s = activateBlock(c, s, "intro:reveal");
      s = activateBlock(c, s, "intro:complete");
      s = visit(c, s, 1);
      s = submit(c, s, "mixed:first", ["a"]);
      s = submit(c, s, "mixed:second", ["a"]);
      const text = ResumeStateSerializer.serialize(
        s,
        "composer",
        3,
        1,
        version,
        composerContext(c),
      );
      expect(JSON.parse(text)[0]).toBe(3);
      const restored = ResumeStateSerializer.deserialize(
        text,
        "composer",
        3,
        1,
        version,
        composerContext(c),
      );
      expect(restored).toEqual(s);
      expect(() => validateComposerResume(c, restored)).not.toThrow();
      expect(submit(c, restored, "mixed:second", ["a"]).life).toBe(75);
    });
    it("rejects missing context, invalid indices and forged credit", () => {
      const c = composerDemoCourse();
      let s = visit(c, initialGame(), 0);
      s = activateBlock(c, s, "intro:reveal");
      s = activateBlock(c, s, "intro:complete");
      s = visit(c, s, 1);
      s = submit(c, s, "mixed:first", ["a"]);
      s = submit(c, s, "mixed:second", ["a"]);
      const data = JSON.parse(
        ResumeStateSerializer.serialize(
          s,
          "composer",
          3,
          1,
          version,
          composerContext(c),
        ),
      );
      expect(() =>
        ResumeStateSerializer.deserialize(
          JSON.stringify(data),
          "composer",
          3,
          1,
          version,
        ),
      ).toThrow(/context/);
      data[13][0][0] = 99999;
      expect(() =>
        ResumeStateSerializer.deserialize(
          JSON.stringify(data),
          "composer",
          3,
          1,
          version,
          composerContext(c),
        ),
      ).toThrow();
      s.composer!.answers["mixed:second"].credit = 3333;
      expect(() => validateComposerResume(c, s)).toThrow();
    });
    it("pre-validates worst-case composer resume capacity", () => {
      const c = composerDemoCourse();
      expect(
        new ExportValidator().validate(c, {
          revision: 1,
          scope: "course",
          version,
        }).errors,
      ).toEqual([]);
    });
  });

describe("safe required-work paths", () => {
  it("does not count a mistake-only reveal as a guaranteed path to mandatory work", () => {
    const q = demoQuestion("safe-q", "Choose A and B", "main", true);
    const block = {
      ...newBlock("content"),
      id: "hidden-required",
      kind: "content" as const,
      text: "Required",
      required: true,
      visible: false,
    };
    const s = composerSlide("Safety", "safe-slide", [q, block], {
      rules: [
        {
          id: "partial-only",
          trigger: { event: "partial", sourceId: q.id },
          actions: [{ type: "show", targetId: block.id }],
        },
      ],
    });
    expect(compositionSchema.safeParse(s.composition).success).toBe(false);
    s.composition!.rules.push({
      id: "safe-correct",
      trigger: { event: "correct", sourceId: q.id },
      actions: [{ type: "show", targetId: block.id }],
    });
    expect(compositionSchema.safeParse(s.composition).success).toBe(true);
  });
  it("prevents navigating away before attached feedback is presented", () => {
    const c = newCourse("Feedback navigation");
    const q = demoQuestion("navigation-q", "Question");
    c.levels[0].slides = [
      composerSlide(
        "Feedback",
        "feedback-slide",
        [
          q,
          {
            ...newBlock("feedback"),
            kind: "feedback",
            id: "nav-feedback",
            visible: false,
            interactionId: q.id,
            condition: "correct",
            text: "Read this feedback",
            presentation: "inline",
          },
        ],
        {
          rules: [
            {
              id: "skip-feedback",
              trigger: { event: "correct", sourceId: q.id },
              actions: [{ type: "navigate", slideId: "after-feedback" }],
            },
          ],
        },
      ),
      { ...newSlide("Next"), id: "after-feedback" },
    ];
    expect(courseSchema.safeParse(c).success).toBe(false);
  });
});

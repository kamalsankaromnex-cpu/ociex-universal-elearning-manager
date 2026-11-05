import { describe, expect, it } from "vitest";
import { courseSchema, newCourse, newSlide } from "../src/lib/course";
import {
  compositionSchema,
  type InteractionBlock,
} from "../src/lib/composer/schema";
import { newBlock, questionSlide } from "../src/lib/composer/model";
import { daimlerEhsDemoCourse } from "../src/lib/game-demo";
import { normalizeSubmission, selectionIds } from "../src/lib/interactions";
import {
  initialGame,
  visit,
  submitQuestion,
  completeVideoBlock,
} from "../src/lib/game";
import { composerComplete } from "../src/lib/composer/runtime";

describe("visual composer & game-style interactions", () => {
  it("normalizes sequencing activity submissions and scores correctly", () => {
    const parent = newSlide("Safety Culture Stages");
    const seqSlide = {
      ...parent,
      kind: "sequencing" as const,
      options: [
        { id: "s1", text: "Reactive" },
        { id: "s2", text: "Dependant" },
        { id: "s3", text: "Independent" },
        { id: "s4", text: "Interdependent" },
      ],
      correctIds: ["s1", "s2", "s3", "s4"],
      scoringMode: "all-or-nothing" as const,
    };

    // Correct full submission in order
    const correctSub = normalizeSubmission(seqSlide, [
      "s1",
      "s2",
      "s3",
      "s4",
    ]);
    expect(correctSub).not.toBeNull();
    expect(correctSub?.correct).toBe(true);
    expect(correctSub?.credit).toBe(10000);

    // Round-trip encoding and decoding of sequence order
    const decoded = selectionIds(seqSlide, correctSub!.selection);
    expect(decoded).toEqual(["s1", "s2", "s3", "s4"]);

    // Inverted submission with all-or-nothing scoring
    const wrongSub = normalizeSubmission(seqSlide, ["s4", "s3", "s2", "s1"]);
    expect(wrongSub?.correct).toBe(false);
    expect(wrongSub?.credit).toBe(0);

    // Partial-credit scoring mode
    const partialSlide = {
      ...seqSlide,
      scoringMode: "partial-credit" as const,
    };
    // 2 out of 4 in correct position: s1 and s4
    const partialSub = normalizeSubmission(partialSlide, [
      "s1",
      "s3",
      "s2",
      "s4",
    ]);
    expect(partialSub?.correct).toBe(false);
    expect(partialSub?.credit).toBe(5000); // 2/4 = 50%
  });

  it("validates video blocks and triggers video-complete events", () => {
    const videoBlock = newBlock("video", "main");
    expect(videoBlock.kind).toBe("video");
    if (videoBlock.kind !== "video") throw Error();
    expect(videoBlock.startOverlay).toBe(true);

    const buttonBlock = {
      ...newBlock("button", "main"),
      id: "cont-btn",
      visible: false,
    };

    const comp = {
      version: 1 as const,
      layout: { variant: "stacked" as const, regions: ["main"] },
      blocks: [videoBlock, buttonBlock],
      rules: [
        {
          id: "r-video",
          trigger: { event: "video-complete" as const, sourceId: videoBlock.id },
          actions: [{ type: "show" as const, targetId: buttonBlock.id }],
        },
        {
          id: "r-btn",
          trigger: { event: "activate" as const, sourceId: buttonBlock.id },
          actions: [{ type: "complete" as const }],
        },
      ],
      completion: { mode: "manual" as const, required: true, interactionIds: [] },
      navigation: "free" as const,
    };

    expect(compositionSchema.safeParse(comp).success).toBe(true);

    const course = newCourse("Video Demo");
    course.levels[0].slides[0] = {
      ...newSlide("Video Slide"),
      kind: "composed",
      composition: comp,
    };

    let state = visit(course, initialGame(), 0);
    // Button initially not visible
    expect(state.composer?.visibility["cont-btn"]).toBeUndefined();

    // Trigger video completion
    state = completeVideoBlock(course, state, videoBlock.id);
    expect(state.composer?.visibility["cont-btn"]).toBe(true);
    expect(state.composer?.seen).toContain(videoBlock.id);
  });

  it("validates character and speech bubble content blocks", () => {
    const charBlock = newBlock("character", "left");
    expect(charBlock.kind).toBe("character");
    if (charBlock.kind !== "character") throw Error();
    expect(charBlock.character).toBe("safety-officer");

    const bubbleBlock = {
      ...newBlock("content", "right"),
      contentVariant: "speech-bubble" as const,
      speaker: "Safety Officer",
      text: "A colleague bypassed a machine guard. What could happen next?",
    };

    const comp = {
      version: 1 as const,
      layout: { variant: "columns" as const, regions: ["left", "right"] },
      blocks: [charBlock, bubbleBlock],
      rules: [],
      completion: { mode: "view" as const, required: true, interactionIds: [] },
      navigation: "free" as const,
      scene: { preset: "industrial-plant" as const },
    };

    expect(compositionSchema.safeParse(comp).success).toBe(true);
  });

  it("supports game-mode course theme preset", () => {
    const course = newCourse("Daimler Safety Game");
    course.theme.style = "game";
    course.theme.header = "#0B1F3A";
    course.theme.gameAccent = "#F59E0B";

    const parsed = courseSchema.safeParse(course);
    expect(parsed.success).toBe(true);
  });

  it("validates and plays through the Daimler EHS Game Experience course fixture", () => {
    const course = daimlerEhsDemoCourse();
    const result = courseSchema.safeParse(course);
    if (!result.success) {
      console.error(result.error.issues);
    }
    expect(result.success).toBe(true);
    expect(course.levels[0].slides.length).toBe(6);

    // Slide 1: Content only (view completion, free navigation)
    let state = visit(course, initialGame(), 0);
    expect(state.life).toBe(100);
    expect(composerComplete(course.levels[0].slides[0], state, 0)).toBe(true);

    // Slide 2: Multi-select machine guard question
    state = visit(course, state, 1);
    const s2 = course.levels[0].slides[1];
    const q2Block = s2.composition!.blocks.find((b) => b.kind === "interaction");
    expect(q2Block).toBeDefined();

    // Partial/wrong submission costs 25% life (Daimler approved default)
    const wrongSub = normalizeSubmission(
      questionSlide(s2, q2Block as InteractionBlock),
      ["inj"],
    );
    state = submitQuestion(course, state, wrongSub);
    expect(state.life).toBe(75);

    // Correct submission of all 5 options completes the slide
    const correctSub = normalizeSubmission(
      questionSlide(s2, q2Block as InteractionBlock),
      ["inj", "eqp", "prd", "env", "fin"],
    );
    state = submitQuestion(course, state, correctSub);
    expect(state.life).toBe(75); // No duplicate penalty
    expect(composerComplete(s2, state, 1)).toBe(true);

    // Slide 3: Single-choice committee question
    state = visit(course, state, 2);
    const s3 = course.levels[0].slides[2];
    const q3Block = s3.composition!.blocks.find((b) => b.kind === "interaction");
    const sub3 = normalizeSubmission(
      questionSlide(s3, q3Block as InteractionBlock),
      ["apex"],
    );
    state = submitQuestion(course, state, sub3);
    expect(composerComplete(s3, state, 2)).toBe(true);

    // Slide 4: Video and Sequencing
    state = visit(course, state, 3);
    const s4 = course.levels[0].slides[3];
    const videoBlock = s4.composition!.blocks.find((b) => b.kind === "video");
    const seqBlock = s4.composition!.blocks.find((b) => b.kind === "interaction");
    expect(videoBlock).toBeDefined();
    expect(seqBlock).toBeDefined();

    // Complete video
    state = completeVideoBlock(course, state, videoBlock!.id);
    expect(state.composer?.seen).toContain(videoBlock!.id);

    // Sequencing answer
    const seqSub = normalizeSubmission(
      questionSlide(s4, seqBlock as InteractionBlock),
      ["react", "dep", "indep", "interdep"],
    );
    expect(seqSub?.correct).toBe(true);
    state = submitQuestion(course, state, seqSub);
    expect(composerComplete(s4, state, 3)).toBe(true);
  });
});

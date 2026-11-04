import { newCourse, newSlide, type Slide } from "../course";
import { newBlock } from "./model";
import type { Block, Composition, InteractionBlock } from "./schema";
export function composerSlide(
  title: string,
  id: string,
  blocks: Block[],
  patch: Partial<Composition> = {},
): Slide {
  return {
    ...newSlide(title),
    id,
    kind: "composed",
    text: "",
    image: "",
    composition: {
      version: 1,
      layout: { variant: "stacked", regions: ["main"] },
      blocks,
      rules: [],
      completion: { mode: "activities", required: true, interactionIds: [] },
      navigation: "free",
      ...patch,
    },
  };
}
export function demoQuestion(
  id: string,
  prompt: string,
  region = "main",
  multi = false,
): InteractionBlock {
  const block = newBlock("interaction", region);
  if (block.kind !== "interaction") throw Error("Invalid question factory");
  return {
    ...block,
    id,
    question: {
      ...block.question,
      prompt,
      kind: multi ? "multi-select" : "single-choice",
      options: multi
        ? [
            { id: "a", text: "Demonstration choice A" },
            { id: "b", text: "Demonstration choice B" },
            { id: "c", text: "Demonstration distractor C" },
          ]
        : block.question.options,
      correctId: "a",
      ...(multi
        ? { correctIds: ["a", "b"], scoringMode: "partial-credit" as const }
        : {}),
    },
  };
}
export function demoFeedback(
  id: string,
  interactionId: string,
  condition: "correct" | "incorrect" | "partial" | "retry",
  text: string,
  region = "main",
  presentation: "inline" | "popup" | "overlay" = "inline",
): Block {
  return {
    ...newBlock("feedback", region),
    kind: "feedback",
    id,
    visible: false,
    interactionId,
    condition,
    text,
    presentation,
    layer: presentation === "inline" ? "base" : "overlay",
  };
}
export function composerDemoCourse() {
  const c = newCourse("Universal Slide Composer — demonstration");
  c.header.title = c.title;
  c.description =
    "Layout, conditional feedback, multiple activities and completion acceptance fixture. Not approved training content.";
  const intro = composerSlide(
    "Content-only orientation",
    "composer:intro",
    [
      {
        ...newBlock("content"),
        kind: "content",
        id: "intro:first",
        text: "This slide has multiple content sections and no question. Reveal the details, then mark it complete.",
      },
      {
        ...newBlock("content"),
        kind: "content",
        id: "intro:details",
        text: "These required details are revealed by an explicit button action.",
        visible: false,
        required: true,
      },
      {
        ...newBlock("button"),
        kind: "button",
        id: "intro:reveal",
        label: "Reveal details",
      },
      {
        ...newBlock("content"),
        kind: "content",
        id: "intro:last",
        text: "Content can appear before or after a control. There is no fixed question position.",
      },
      {
        ...newBlock("button"),
        kind: "button",
        id: "intro:complete",
        label: "Mark slide complete",
      },
    ],
    {
      completion: { mode: "manual", required: true, interactionIds: [] },
      navigation: "after-completion",
      rules: [
        {
          id: "intro:show-rule",
          trigger: { event: "activate", sourceId: "intro:reveal" },
          actions: [{ type: "show", targetId: "intro:details" }],
        },
        {
          id: "intro:complete-rule",
          trigger: { event: "activate", sourceId: "intro:complete" },
          actions: [{ type: "complete" }],
        },
      ],
    },
  );
  const first = demoQuestion(
      "mixed:first",
      "First independent activity",
      "left",
    ),
    second = {
      ...demoQuestion(
        "mixed:second",
        "Second independent activity",
        "right",
        true,
      ),
      visible: false,
    };
  const mixed = composerSlide(
    "Two independent activities",
    "composer:mixed",
    [
      demoFeedback(
        "mixed:first-correct",
        first.id,
        "correct",
        "First activity feedback remains independent of the second.",
        "left",
      ),
      first,
      {
        ...newBlock("content", "left"),
        kind: "content",
        id: "mixed:after",
        text: "This content follows the first interaction.",
      },
      {
        ...newBlock("content", "right"),
        kind: "content",
        id: "mixed:before",
        text: "This content precedes the second interaction. Pass the first activity to reveal it.",
      },
      second,
      demoFeedback(
        "mixed:first-incorrect",
        first.id,
        "incorrect",
        "Review the first activity and select A.",
        "left",
        "popup",
      ),
      demoFeedback(
        "mixed:first-retry",
        first.id,
        "retry",
        "Retry feedback belongs only to the first activity.",
        "left",
      ),
      demoFeedback(
        "mixed:second-partial",
        second.id,
        "partial",
        "You selected part of the second answer set. Select A and B for exact completion.",
        "right",
        "overlay",
      ),
      demoFeedback(
        "mixed:second-correct",
        second.id,
        "correct",
        "Both second-activity answers are correct.",
        "right",
        "popup",
      ),
      demoFeedback(
        "mixed:second-incorrect",
        second.id,
        "incorrect",
        "Review only the second activity.",
        "right",
      ),
      demoFeedback(
        "mixed:second-retry",
        second.id,
        "retry",
        "Retry the second activity; prior credit and penalty remain.",
        "right",
      ),
    ],
    {
      layout: { variant: "columns", regions: ["left", "right"] },
      navigation: "after-completion",
      rules: [
        {
          id: "mixed:reveal-second",
          trigger: { event: "correct", sourceId: first.id },
          actions: [
            { type: "record-result", targetId: first.id },
            { type: "show", targetId: second.id },
          ],
        },
      ],
    },
  );
  const optional = demoQuestion(
    "optional:question",
    "Optional unscored practice",
  );
  optional.question.mandatory = false;
  optional.question.scored = false;
  optional.question.lifePenalty = 0;
  const last = composerSlide(
    "Optional practice",
    "composer:optional",
    [
      {
        ...newBlock("content"),
        kind: "content",
        id: "optional:text",
        text: "This slide is optional and its activity is unscored. It cannot change your course score.",
      },
      optional,
      demoFeedback(
        "optional:feedback",
        optional.id,
        "incorrect",
        "Optional practice feedback.",
      ),
    ],
    { completion: { mode: "view", required: false, interactionIds: [] } },
  );
  c.levels[0].id = "composer:demo-level";
  c.levels[0].title = "Composer acceptance";
  c.levels[0].slides = [intro, mixed, last];
  return c;
}

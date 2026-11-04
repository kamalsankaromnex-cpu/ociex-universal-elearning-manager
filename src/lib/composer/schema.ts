import { z } from "zod";
import { media } from "../slide-primitives";
const id = z
  .string()
  .min(1)
  .max(180)
  .refine(
    (v) => !["__proto__", "prototype", "constructor"].includes(v),
    "Use a safe stable identifier",
  );
export const questionSchema = z
  .object({
    kind: z.enum(["single-choice", "multi-select", "sequencing"]),
    prompt: z.string().trim().min(1).max(10000),
    options: z
      .array(
        z
          .object({
            id,
            text: z.string().trim().min(1).max(500),
            image: media.optional(),
            imageAlt: z.string().max(200).optional(),
          })
          .refine(
            (o) => !o.image || !!o.imageAlt?.trim(),
            "Answer images need alternative text",
          ),
      )
      .min(2)
      .max(6),
    correctId: z.string().optional(),
    correctIds: z.array(id).min(1).max(6).optional(),
    scoringMode: z.enum(["all-or-nothing", "partial-credit"]).optional(),
    mandatory: z.boolean(),
    scored: z.boolean(),
    lifePenalty: z.number().int().min(0).max(100),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.options.map((o) => o.id)).size !== q.options.length)
      ctx.addIssue({ code: "custom", message: "Option IDs must be unique" });
    if (q.kind === "sequencing") {
      if (
        !q.correctIds?.length ||
        q.correctIds.length !== q.options.length ||
        new Set(q.correctIds).size !== q.options.length ||
        q.correctIds.some((x) => !q.options.some((o) => o.id === x))
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Sequencing activities require all options defined in the correct sequence order",
        });
      return;
    }
    const correct = q.kind === "single-choice" ? [q.correctId] : q.correctIds;
    if (
      !correct?.length ||
      correct.some((x) => !q.options.some((o) => o.id === x)) ||
      new Set(correct).size !== correct.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose existing, unique correct answers",
      });
  });
const base = {
  id,
  version: z.literal(1),
  region: id,
  layer: z.enum(["base", "overlay"]),
  visible: z.boolean(),
  required: z.boolean(),
  locked: z.boolean().optional(),
  customStyle: z
    .object({
      align: z.enum(["left", "center", "right"]).optional(),
      opacity: z.number().min(0).max(100).optional(),
      borderStyle: z.enum(["none", "solid", "dashed", "game-card"]).optional(),
      accentColor: z.string().optional(),
    })
    .optional(),
};
export const blockSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("content"),
    text: z.string().trim().min(1).max(10000),
    contentVariant: z
      .enum([
        "standard",
        "speech-bubble",
        "scenario-panel",
        "heading-banner",
        "notice",
      ])
      .optional(),
    speaker: z.string().max(80).optional(),
    bubbleTail: z.enum(["left", "right", "top", "bottom"]).optional(),
    title: z.string().max(160).optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("media"),
    src: media.refine(Boolean, "Choose an image"),
    alt: z.string().trim().min(1).max(200),
    caption: z.string().max(200).optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("video"),
    src: z.string().max(2000000).default(""),
    poster: media.optional(),
    title: z.string().trim().max(200).optional(),
    autoplay: z.boolean().optional(),
    startOverlay: z.boolean().default(true),
    startButtonLabel: z.string().trim().max(80).default("Start Video"),
    allowSkip: z.boolean().default(true),
  }),
  z.object({
    ...base,
    kind: z.literal("character"),
    character: z.enum([
      "safety-officer",
      "fox-mascot",
      "robot-drone",
      "character-group",
      "custom",
    ]),
    pose: z
      .enum(["standing", "thinking", "pointing", "celebrating"])
      .optional(),
    name: z.string().max(80).optional(),
    customSrc: media.optional(),
    alt: z.string().trim().min(1).max(200),
    flip: z.boolean().optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("interaction"),
    question: questionSchema,
  }),
  z.object({
    ...base,
    kind: z.literal("feedback"),
    interactionId: id,
    condition: z.enum(["correct", "incorrect", "partial", "retry"]),
    text: z.string().trim().min(1).max(2000),
    presentation: z.enum(["inline", "popup", "overlay"]),
  }),
  z.object({
    ...base,
    kind: z.literal("button"),
    label: z.string().trim().min(1).max(160),
    buttonVariant: z.enum(["primary", "secondary", "pill", "game"]).optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("recovery"),
    amount: z.number().int().min(0).max(100),
  }),
]);
export const triggerSchema = z.object({
  event: z.enum([
    "enter",
    "activate",
    "correct",
    "incorrect",
    "partial",
    "retry",
    "video-complete",
  ]),
  sourceId: id.optional(),
});
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["show", "hide", "feedback"]), targetId: id }),
  z.object({ type: z.literal("record-result"), targetId: id }),
  z.object({ type: z.literal("complete") }),
  z.object({ type: z.literal("navigate"), slideId: id }),
]);
export const ruleSchema = z.object({
  id,
  trigger: triggerSchema,
  actions: z.array(actionSchema).min(1).max(16),
});
export const compositionSchema = z
  .object({
    version: z.literal(1),
    layout: z.object({
      variant: z.enum(["stacked", "columns", "left-wide", "right-wide"]),
      regions: z.array(id).min(1).max(3),
    }),
    blocks: z.array(blockSchema).min(1).max(64),
    rules: z.array(ruleSchema).max(64),
    completion: z.object({
      mode: z.enum(["view", "activities", "manual"]),
      required: z.boolean(),
      interactionIds: z.array(id).max(64),
    }),
    navigation: z.enum(["free", "after-completion"]),
    scene: z
      .object({
        background: z.string().optional(),
        titleBanner: z.string().optional(),
        preset: z
          .enum(["industrial-plant", "workshop", "clean-room", "custom"])
          .optional(),
      })
      .optional(),
  })
  .superRefine((c, ctx) => {
    for (const message of validateComposition(c))
      ctx.addIssue({ code: "custom", message });
  });
export type Composition = z.infer<typeof compositionSchema>;
export type Block = z.infer<typeof blockSchema>;
export type InteractionBlock = Extract<Block, { kind: "interaction" }>;
export type Rule = z.infer<typeof ruleSchema>;
export type ComposerEvent = z.infer<typeof triggerSchema>;
export function validateComposition(c: Composition): string[] {
  const errors: string[] = [];
  const blocks = new Map(c.blocks.map((b) => [b.id, b]));
  if (blocks.size !== c.blocks.length) errors.push("Block IDs must be unique");
  if (new Set(c.rules.map((r) => r.id)).size !== c.rules.length)
    errors.push("Rule IDs must be unique");
  if (new Set(c.layout.regions).size !== c.layout.regions.length)
    errors.push("Layout regions must be unique");
  if (c.layout.variant !== "stacked" && c.layout.regions.length !== 2)
    errors.push("Column layouts need exactly two regions");
  for (const b of c.blocks) {
    if (!c.layout.regions.includes(b.region))
      errors.push(`Block ${b.id} refers to a missing region`);
    if (b.kind !== "feedback" && b.layer !== "base")
      errors.push("Only feedback can use the overlay layer");
    if (b.kind === "feedback") {
      if (blocks.get(b.interactionId)?.kind !== "interaction")
        errors.push(`Feedback ${b.id} needs an existing interaction`);
      if (b.layer !== (b.presentation === "inline" ? "base" : "overlay"))
        errors.push("Feedback layer must match its presentation");
      if (b.required) errors.push("Feedback cannot be a mandatory activity");
      if (b.visible)
        errors.push("Feedback is conditional and cannot be initially visible");
    }
    if (
      !c.completion.required &&
      b.kind === "interaction" &&
      b.question.mandatory
    )
      errors.push("Optional slides cannot contain mandatory questions");
  }
  if (
    new Set(c.completion.interactionIds).size !==
    c.completion.interactionIds.length
  )
    errors.push("Completion interaction references must be unique");
  for (const key of c.completion.interactionIds)
    if (blocks.get(key)?.kind !== "interaction")
      errors.push("Completion refers to a missing interaction");
  for (const r of c.rules) {
    const source = r.trigger.sourceId
      ? blocks.get(r.trigger.sourceId)
      : undefined;
    if (r.trigger.event === "enter") {
      if (r.trigger.sourceId)
        errors.push("Enter rules cannot have a source block");
    } else if (r.trigger.event === "activate") {
      if (source?.kind !== "button")
        errors.push("Activate rules require a button source");
    } else if (r.trigger.event === "video-complete") {
      if (source?.kind !== "video")
        errors.push("Video complete rules require a video source");
    } else if (source?.kind !== "interaction")
      errors.push("Question events require an interaction source");
    if (source?.kind === "interaction") {
      const q = source.question;
      const count =
        q.kind === "single-choice"
          ? 1
          : q.kind === "sequencing"
            ? q.options.length
            : (q.correctIds?.length ?? 0);
      if (
        r.trigger.event === "partial" &&
        !(
          (q.kind === "multi-select" || q.kind === "sequencing") &&
          q.scoringMode === "partial-credit" &&
          count > 1
        )
      )
        errors.push("This question cannot trigger partial-credit rules");
      if (
        r.trigger.event === "incorrect" &&
        q.kind === "multi-select" &&
        q.scoringMode === "partial-credit" &&
        count === q.options.length
      )
        errors.push("This answer set cannot trigger an incorrect event");
    }
    if (
      r.actions.some((a) => a.type === "navigate") &&
      r.trigger.event === "correct" &&
      c.blocks.some(
        (b) =>
          b.kind === "feedback" &&
          b.interactionId === r.trigger.sourceId &&
          b.condition === "correct",
      )
    )
      errors.push(
        "Use a navigation button after feedback instead of navigating away from answer feedback",
      );
    for (const a of r.actions) {
      if ("targetId" in a && !blocks.has(a.targetId))
        errors.push(`Rule ${r.id} refers to a missing block`);
      if (a.type === "feedback" && blocks.get(a.targetId)?.kind !== "feedback")
        errors.push("Feedback actions require a feedback block");
      if (
        a.type === "record-result" &&
        (a.targetId !== r.trigger.sourceId ||
          !["correct", "incorrect", "partial"].includes(r.trigger.event))
      )
        errors.push(
          "Scores can only record the source question's normalized submission",
        );
      if (
        a.type === "navigate" &&
        !["activate", "correct", "video-complete"].includes(r.trigger.event)
      )
        errors.push(
          "Navigation rules need an explicit button, video or correct-answer event",
        );
      if (a.type === "complete" && r.trigger.event === "enter")
        errors.push("Completion actions require an explicit learner event");
      if (a.type === "hide") {
        if (c.rules.some((rule) => rule.trigger.sourceId === a.targetId))
          errors.push("Rules cannot hide a block used as an event source");
        const target = blocks.get(a.targetId);
        if (
          target?.required ||
          (target?.kind === "interaction" &&
            (target.question.mandatory ||
              c.completion.interactionIds.includes(target.id)))
        )
          errors.push("Rules cannot hide mandatory content or activities");
      }
      if (a.type === "feedback") {
        const target = blocks.get(a.targetId);
        if (
          target?.kind === "feedback" &&
          (target.interactionId !== r.trigger.sourceId ||
            target.condition !== r.trigger.event)
        )
          errors.push(
            "Feedback actions must match their source question and condition",
          );
      }
      if (a.type === "show" && blocks.get(a.targetId)?.kind === "feedback")
        errors.push(
          "Use a matching feedback event instead of unconditional feedback reveal",
        );
    }
  }
  // A finite monotone reachability analysis: rule actions never emit new events.
  const reachable = new Set(
    c.blocks.filter((b) => b.visible && b.kind !== "feedback").map((b) => b.id),
  );
  for (let step = 0; step <= c.blocks.length; step++) {
    const size = reachable.size;
    for (const r of c.rules)
      if (
        [
          "enter",
          "activate",
          "correct",
          "retry",
          "video-complete",
        ].includes(r.trigger.event) &&
        (r.trigger.event === "enter" ||
          (!!r.trigger.sourceId && reachable.has(r.trigger.sourceId)))
      )
        for (const a of r.actions)
          if (a.type === "show") reachable.add(a.targetId);
    if (size === reachable.size) break;
  }
  for (const b of c.blocks)
    if (
      (b.required ||
        (b.kind === "interaction" &&
          (b.question.mandatory ||
            c.completion.interactionIds.includes(b.id)))) &&
      !reachable.has(b.id)
    )
      errors.push(`Required block ${b.id} is unreachable`);
  for (const b of c.blocks)
    if (
      b.kind === "button" &&
      !c.rules.some(
        (r) => r.trigger.event === "activate" && r.trigger.sourceId === b.id,
      )
    )
      errors.push("Action buttons need an activate rule");
  if (
    c.completion.mode === "manual" &&
    !c.rules.some(
      (r) =>
        ["activate", "correct", "retry", "video-complete"].includes(
          r.trigger.event,
        ) &&
        !!r.trigger.sourceId &&
        reachable.has(r.trigger.sourceId) &&
        r.actions.some((a) => a.type === "complete"),
    )
  )
    errors.push("Manual completion needs a reachable completion action");
  return [...new Set(errors)];
}
export function validateCourseCompositions(course: {
  levels: {
    id: string;
    slides: { id: string; kind: string; composition?: Composition }[];
  }[];
}): string[] {
  const slides = course.levels.flatMap((l) => l.slides);
  const slideIndices = new Map(slides.map((s, index) => [s.id, index]));
  const ids = new Set(
    slides.flatMap((s) => [
      s.id,
      ...(s.composition?.blocks.map((b) => b.id) ?? []),
    ]),
  );
  const count = slides.reduce(
    (n, s) => n + 1 + (s.composition?.blocks.length ?? 0),
    0,
  );
  const errors: string[] = [];
  if (ids.size !== count)
    errors.push("Slide and block IDs must be unique across the course");
  for (const [index, s] of slides.entries()) {
    if (s.kind !== "composed" && s.composition)
      errors.push("Compositions require the composed slide type");
    for (const r of s.composition?.rules ?? [])
      for (const a of r.actions)
        if (a.type === "navigate") {
          const target = slideIndices.get(a.slideId) ?? -1;
          if (target <= index)
            errors.push(
              "Navigation actions must reference a later existing slide; backward/self loops are not allowed",
            );
        }
  }
  return [...new Set(errors)];
}

import type { Slide, CourseData } from "../course";
import type { Block, Composition, InteractionBlock } from "./schema";
export function questionSlide(parent: Slide, block: InteractionBlock): Slide {
  return {
    ...parent,
    ...block.question,
    id: block.id,
    kind: block.question.kind,
    text: block.question.prompt,
    composition: undefined,
    image: "",
    correctId:
      block.question.correctId ?? block.question.correctIds?.[0] ?? "a",
    correctIds:
      block.question.correctIds ??
      (block.question.kind === "sequencing"
        ? block.question.options.map((o) => o.id)
        : undefined),
    correctFeedback: "Correct",
    incorrectFeedback: "Try again",
  };
}
export function newBlock(kind: Block["kind"], region = "main"): Block {
  const base = {
    id: crypto.randomUUID(),
    version: 1 as const,
    region,
    layer: "base" as const,
    visible: true,
    required: false,
  };
  switch (kind) {
    case "content":
      return { ...base, kind, text: "Add a content section." };
    case "media":
      return { ...base, kind, src: "", alt: "" };
    case "video":
      return {
        ...base,
        kind,
        src: "",
        poster: "",
        title: "Safety briefing video",
        startOverlay: true,
        startButtonLabel: "Start Video",
        allowSkip: true,
      };
    case "character":
      return {
        ...base,
        kind,
        character: "safety-officer",
        pose: "standing",
        name: "Safety Officer",
        alt: "Illustrated Safety Officer in yellow hard hat",
      };
    case "interaction":
      return {
        ...base,
        kind,
        question: {
          kind: "single-choice",
          prompt: "Choose the demonstration answer A.",
          options: [
            { id: "a", text: "Answer A" },
            { id: "b", text: "Answer B" },
          ],
          correctId: "a",
          mandatory: true,
          scored: true,
          lifePenalty: 25,
        },
      };
    case "feedback":
      return {
        ...base,
        kind,
        visible: false,
        interactionId: "",
        condition: "correct",
        text: "Correct — demonstration feedback.",
        presentation: "inline",
      };
    case "button":
      return {
        ...base,
        kind,
        label: "Continue activity",
        buttonVariant: "game",
      };
    case "recovery":
      return { ...base, kind, amount: 25 };
  }
}
export function convertSlide(
  slide: Slide,
  defaults?: CourseData["rules"],
): Slide {
  if (slide.composition) return slide;
  const blocks: Block[] = [];
  if (slide.text.trim())
    blocks.push({
      ...newBlock("content"),
      id: `${slide.id}:text`,
      kind: "content",
      text: slide.text,
    });
  if (slide.image)
    blocks.push({
      ...newBlock("media"),
      id: `${slide.id}:media`,
      kind: "media",
      src: slide.image,
      alt: slide.title,
    });
  if (
    slide.kind === "single-choice" ||
    slide.kind === "multi-select" ||
    slide.kind === "sequencing"
  ) {
    const id = `${slide.id}:question`;
    blocks.push({
      ...newBlock("interaction"),
      id,
      kind: "interaction",
      question: {
        kind: slide.kind,
        prompt: slide.title,
        options: slide.options,
        correctId: slide.correctId,
        correctIds: slide.correctIds,
        scoringMode: slide.scoringMode,
        mandatory: slide.mandatory !== false,
        scored: slide.scored !== false,
        lifePenalty: slide.lifePenalty ?? defaults?.penalty ?? 25,
      },
    });
    for (const condition of [
      "correct",
      "incorrect",
      "partial",
      "retry",
    ] as const)
      blocks.push({
        ...newBlock("feedback"),
        id: `${slide.id}:${condition}`,
        kind: "feedback",
        visible: false,
        interactionId: id,
        condition,
        text:
          condition === "correct"
            ? slide.correctFeedback
            : condition === "partial"
              ? (slide.partialFeedback ?? slide.incorrectFeedback)
              : condition === "retry"
                ? "Try this activity again. Your best credit and prior life penalty are retained."
                : slide.incorrectFeedback,
        presentation: "inline",
      });
  }
  if (slide.kind === "recovery")
    blocks.push({
      ...newBlock("recovery"),
      kind: "recovery",
      amount: slide.lifeRecovery ?? defaults?.recovery ?? 25,
    });
  if (!blocks.length) blocks.push(newBlock("content"));
  return {
    ...slide,
    kind: "composed",
    composition: {
      version: 1,
      layout: { variant: "stacked", regions: ["main"] },
      blocks,
      rules: [],
      completion: { mode: "activities", required: true, interactionIds: [] },
      navigation: "free",
    },
  };
}
export function duplicateSlide(slide: Slide): Slide {
  const copy = structuredClone(slide);
  copy.id = crypto.randomUUID();
  copy.title += " (copy)";
  if (copy.composition) {
    const ids = new Map(
      copy.composition.blocks.map((b) => [b.id, crypto.randomUUID()]),
    );
    for (const b of copy.composition.blocks) {
      b.id = ids.get(b.id)!;
      if (b.kind === "feedback") b.interactionId = ids.get(b.interactionId)!;
    }
    for (const rule of copy.composition.rules) {
      rule.id = crypto.randomUUID();
      if (rule.trigger.sourceId)
        rule.trigger.sourceId = ids.get(rule.trigger.sourceId)!;
      for (const a of rule.actions)
        if ("targetId" in a) a.targetId = ids.get(a.targetId)!;
    }
    copy.composition.completion.interactionIds =
      copy.composition.completion.interactionIds.map((id) => ids.get(id)!);
  }
  return copy;
}
export function composerContext(course: CourseData) {
  const slides = course.levels.flatMap((l) => l.slides);
  return {
    slides: slides.map((s) => s.id),
    blocks: slides.flatMap((s) => s.composition?.blocks.map((b) => b.id) ?? []),
  };
}
export function compositionMedia(c: Composition) {
  return c.blocks.flatMap((b) =>
    b.kind === "media"
      ? [b.src]
      : b.kind === "video"
        ? [b.poster ?? ""]
        : b.kind === "character"
          ? [b.customSrc ?? ""]
          : b.kind === "interaction"
            ? b.question.options.map((o) => o.image ?? "")
            : [],
  );
}

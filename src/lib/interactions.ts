import type { Slide } from "./course";
export function isQuestion(slide: Pick<Slide, "kind">) {
  return (
    slide.kind === "single-choice" ||
    slide.kind === "multi-select" ||
    slide.kind === "sequencing"
  );
}
export type SubmissionResult = {
  slideId: string;
  kind: "single-choice" | "multi-select" | "sequencing";
  selection: number;
  credit: number; // integer basis points, 0..10000
  correct: boolean;
};

/** Encode an ordered sequence of up to 6 option IDs into a compact integer. */
export function encodeSequenceOrder(
  slide: Slide,
  order: readonly string[],
): number {
  let mask = 0;
  for (let slot = 0; slot < Math.min(order.length, 6); slot++) {
    const optIdx = slide.options.findIndex((o) => o.id === order[slot]);
    if (optIdx >= 0) {
      mask |= ((optIdx + 1) & 0x7) << (slot * 3);
    }
  }
  return mask;
}

/** Decode an ordered sequence of option IDs from a compact integer. */
export function decodeSequenceOrder(slide: Slide, mask: number): string[] {
  if (!mask) return [];
  const result: string[] = [];
  for (let slot = 0; slot < 6; slot++) {
    const val = (mask >> (slot * 3)) & 0x7;
    if (val > 0 && val <= slide.options.length) {
      result.push(slide.options[val - 1].id);
    }
  }
  return result;
}

/** One interaction boundary shared by preview, SCORM player and engine. */
export function normalizeSubmission(
  slide: Slide,
  answers: readonly string[],
): SubmissionResult | null {
  if (!isQuestion(slide) || !answers.length) return null;
  const ids = [...new Set(answers)];
  if (ids.some((id) => !slide.options.some((option) => option.id === id)))
    return null;
  if (slide.kind === "single-choice" && ids.length !== 1) return null;

  if (slide.kind === "sequencing") {
    const correctIds = slide.correctIds ?? slide.options.map((o) => o.id);
    if (answers.length !== correctIds.length) return null;
    let correctCount = 0;
    for (let i = 0; i < correctIds.length; i++) {
      if (answers[i] === correctIds[i]) correctCount++;
    }
    const correct = correctCount === correctIds.length;
    const credit = correct
      ? 10000
      : slide.scoringMode === "partial-credit"
        ? Math.round((correctCount / correctIds.length) * 10000)
        : 0;
    const selection = encodeSequenceOrder(slide, answers);
    return {
      slideId: slide.id,
      kind: "sequencing",
      selection,
      credit,
      correct,
    };
  }

  const correctIds =
    slide.kind === "multi-select" ? slide.correctIds : [slide.correctId];
  if (
    !correctIds?.length ||
    new Set(correctIds).size !== correctIds.length ||
    correctIds.some((id) => !slide.options.some((o) => o.id === id))
  )
    return null;
  const correctSelected = ids.filter((id) => correctIds.includes(id)).length;
  const incorrectSelected = ids.length - correctSelected;
  const correct =
    incorrectSelected === 0 && correctSelected === correctIds.length;
  const credit = correct
    ? 10000
    : slide.kind === "multi-select" && slide.scoringMode === "partial-credit"
      ? Math.round(
          Math.max(
            0,
            (correctSelected - incorrectSelected) / correctIds.length,
          ) * 10000,
        )
      : 0;
  const selection = slide.options.reduce(
    (mask, option, index) =>
      ids.includes(option.id) ? mask | (1 << index) : mask,
    0,
  );
  return {
    slideId: slide.id,
    kind: slide.kind as SubmissionResult["kind"],
    selection,
    credit,
    correct,
  };
}

export function selectionIds(slide: Slide, mask: number): string[] {
  if (slide.kind === "sequencing") {
    return decodeSequenceOrder(slide, mask);
  }
  return slide.options
    .filter((_, index) => mask & (1 << index))
    .map((option) => option.id);
}

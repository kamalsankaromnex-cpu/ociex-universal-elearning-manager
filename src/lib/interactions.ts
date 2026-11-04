import type { Slide } from "./course";
export function isQuestion(slide: Pick<Slide, "kind">) {
  return slide.kind === "single-choice" || slide.kind === "multi-select";
}
export type SubmissionResult = {
  slideId: string;
  kind: "single-choice" | "multi-select";
  selection: number;
  credit: number; // integer basis points, 0..10000
  correct: boolean;
};
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
export function selectionIds(slide: Slide, mask: number) {
  return slide.options
    .filter((_, index) => mask & (1 << index))
    .map((option) => option.id);
}

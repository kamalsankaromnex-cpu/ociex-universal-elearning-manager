import { z } from "zod";
import {
  isQuestion,
  normalizeSubmission,
  selectionIds,
  type SubmissionResult,
} from "./interactions";
import type { CourseData } from "./course";
export const gameStateSchema = z.object({
  life: z.number().int().min(0).max(100),
  index: z.number().int().min(0),
  visited: z.array(z.number().int().min(0)),
  passed: z.array(z.number().int().min(0)),
  penalized: z.array(z.number().int().min(0)),
  recovered: z.array(z.number().int().min(0)),
  completedLevels: z.array(z.number().int().min(0)),
  stars: z.array(z.number().int().min(0)),
  attempts: z.number().int().min(0).max(1000000),
  finished: z.boolean(),
  multi: z
    .record(
      z.string().regex(/^(0|[1-9]\d*)$/),
      z.object({
        selection: z.number().int().min(1).max(63),
        credit: z.number().int().min(0).max(10000),
      }),
    )
    .optional(),
});
export type LearnerGameState = z.infer<typeof gameStateSchema>;
export const initialGame = (): LearnerGameState => ({
  life: 100,
  index: 0,
  visited: [],
  passed: [],
  penalized: [],
  recovered: [],
  completedLevels: [],
  stars: [],
  attempts: 0,
  finished: false,
});
export const flatten = (course: CourseData) =>
  course.levels.flatMap((level, levelIndex) =>
    level.slides.map((slide) => ({
      ...slide,
      levelTitle: level.title,
      levelIndex,
    })),
  );
export function assessment(course: CourseData, state: LearnerGameState) {
  const slides = flatten(course),
    questions = slides.flatMap((s, i) =>
      isQuestion(s) &&
      s.scored !== false &&
      (s.mandatory !== false || course.rules?.optionalScoring !== "exclude") &&
      (s.mandatory !== false ||
        course.rules?.unansweredScoring !== "exclude-optional" ||
        state.passed.includes(i) ||
        state.penalized.includes(i))
        ? [i]
        : [],
    );
  const mandatory = slides.every(
    (s, i) =>
      !isQuestion(s) || s.mandatory === false || state.passed.includes(i),
  );
  const visited = slides.every((_, i) => state.visited.includes(i));
  const score = questions.length
    ? Math.round(
        (questions.reduce(
          (total, i) =>
            total +
            (state.passed.includes(i)
              ? 1
              : (state.multi?.[i]?.credit ?? 0) / 10000),
          0,
        ) /
          questions.length) *
          100,
      )
    : 100;
  return {
    eligible: slides.length > 0 && mandatory && visited && state.life > 0,
    score,
    success: score >= (course.rules?.passScore ?? 80),
    assessmentComplete:
      questions.length > 0 &&
      questions.every(
        (i) => state.passed.includes(i) || state.penalized.includes(i),
      ),
    progress: slides.length ? state.visited.length / slides.length : 0,
  };
}
function award(course: CourseData, state: LearnerGameState) {
  const slides = flatten(course);
  const completed = course.levels.flatMap((_, l) => {
    const entries = slides.flatMap((s, i) => (s.levelIndex === l ? [i] : []));
    return entries.length &&
      entries.every(
        (i) =>
          state.visited.includes(i) &&
          (!isQuestion(slides[i]) ||
            slides[i].mandatory === false ||
            state.passed.includes(i)),
      ) &&
      state.life > 0
      ? [l]
      : [];
  });
  return { ...state, completedLevels: completed, stars: completed };
}
export function visit(
  course: CourseData,
  state: LearnerGameState,
  index: number,
) {
  const slides = flatten(course);
  if (index < 0 || index >= slides.length || state.life === 0) return state;
  if (state.finished) return { ...state, index };
  return award(course, {
    ...state,
    index,
    visited: [...new Set([...state.visited, index])],
  });
}
export function answerQuestion(
  course: CourseData,
  state: LearnerGameState,
  answer: string,
) {
  const slide = flatten(course)[state.index];
  if (!slide || slide.kind !== "single-choice") return state;
  return submitQuestion(course, state, normalizeSubmission(slide, [answer]));
}
export function submitQuestion(
  course: CourseData,
  state: LearnerGameState,
  result: SubmissionResult | null,
) {
  const slide = flatten(course)[state.index];
  if (
    state.finished ||
    state.life === 0 ||
    !slide ||
    !result ||
    result.slideId !== slide.id ||
    result.kind !== slide.kind
  )
    return state;
  const checked = normalizeSubmission(
    slide,
    selectionIds(slide, result.selection),
  );
  if (
    !checked ||
    checked.selection !== result.selection ||
    checked.credit !== result.credit ||
    checked.correct !== result.correct
  )
    return state;
  let next = state;
  if (slide.kind === "multi-select") {
    const previous = state.multi?.[state.index];
    const entry = {
      selection: result.selection,
      credit: Math.max(previous?.credit ?? 0, result.credit),
    };
    if (
      previous?.selection !== entry.selection ||
      previous?.credit !== entry.credit
    )
      next = { ...next, multi: { ...state.multi, [state.index]: entry } };
  }
  if (result.correct) {
    if (state.passed.includes(state.index)) return next;
    return award(course, { ...next, passed: [...state.passed, state.index] });
  }
  if (state.penalized.includes(state.index)) return next;
  return {
    ...next,
    life: Math.max(
      0,
      state.life - (slide.lifePenalty ?? course.rules?.penalty ?? 25),
    ),
    penalized: [...state.penalized, state.index],
    finished: false,
  };
}
export function recoverLife(course: CourseData, state: LearnerGameState) {
  const slide = flatten(course)[state.index];
  if (
    state.finished ||
    !slide ||
    slide.kind !== "recovery" ||
    state.life === 0 ||
    state.recovered.includes(state.index)
  )
    return state;
  return award(course, {
    ...state,
    life: Math.min(
      100,
      state.life + (slide.lifeRecovery ?? course.rules?.recovery ?? 25),
    ),
    recovered: [...state.recovered, state.index],
  });
}
export function retryLevel(course: CourseData, state: LearnerGameState) {
  if (state.finished) return state;
  const slides = flatten(course),
    level = slides[state.index]?.levelIndex;
  if (level === undefined) return state;
  const keep = (indices: number[]) =>
    indices.filter((i) => slides[i]?.levelIndex !== level);
  return {
    ...state,
    life: 100,
    index: slides.findIndex((s) => s.levelIndex === level),
    visited: keep(state.visited),
    passed: keep(state.passed),
    penalized: keep(state.penalized),
    recovered: keep(state.recovered),
    stars: state.stars.filter((l) => l !== level),
    completedLevels: state.completedLevels.filter((l) => l !== level),
    attempts: state.attempts + 1,
    ...(state.multi
      ? {
          multi: Object.fromEntries(
            Object.entries(state.multi).filter(
              ([index]) => slides[Number(index)]?.levelIndex !== level,
            ),
          ),
        }
      : {}),
    finished: false,
  };
}
export function finishGame(course: CourseData, state: LearnerGameState) {
  return assessment(course, state).eligible
    ? { ...state, finished: true }
    : state;
}

/** Check compact multi-select resume records against this immutable package. */
export function validateMultiResume(
  course: CourseData,
  state: LearnerGameState,
) {
  const slides = flatten(course);
  for (const [index, slide] of slides.entries()) {
    if (
      slide.kind === "multi-select" &&
      (state.passed.includes(index) || state.penalized.includes(index)) &&
      !state.multi?.[index]
    )
      throw new Error("Multi-select resume credit is missing");
  }
  for (const [key, entry] of Object.entries(state.multi ?? {})) {
    const index = Number(key),
      slide = slides[index];
    if (!slide || slide.kind !== "multi-select")
      throw new Error("Multi-select resume question is invalid");
    const result = normalizeSubmission(
      slide,
      selectionIds(slide, entry.selection),
    );
    const allowed =
      slide.scoringMode === "partial-credit"
        ? Array.from({ length: slide.correctIds!.length + 1 }, (_, i) =>
            Math.round((i / slide.correctIds!.length) * 10000),
          )
        : [0, 10000];
    if (
      !result ||
      result.selection !== entry.selection ||
      !allowed.includes(entry.credit) ||
      entry.credit < result.credit ||
      (entry.credit === 10000) !== state.passed.includes(index) ||
      (!result.correct && !state.penalized.includes(index))
    )
      throw new Error("Multi-select resume score or selection is invalid");
  }
}

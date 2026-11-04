import { z } from "zod";
import { composerStateSchema } from "./composer/state";
import { questionSlide } from "./composer/model";
import {
  composerComplete,
  canNavigate,
  composerEvent,
  submitComposer,
  activateComposer,
  retryComposer,
  recoverComposer,
  resetComposerLevel,
} from "./composer/runtime";
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
  composer: composerStateSchema.optional(),
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
export function allQuestions(course: CourseData) {
  return flatten(course).flatMap((slide, index) =>
    slide.composition
      ? slide.composition.blocks.flatMap((block) =>
          block.kind === "interaction"
            ? [{ question: questionSlide(slide, block), index, composed: true }]
            : [],
        )
      : isQuestion(slide)
        ? [{ question: slide, index, composed: false }]
        : [],
  );
}
export function assessment(course: CourseData, state: LearnerGameState) {
  const slides = flatten(course);
  const questions = allQuestions(course).filter(
    ({ question: q, index, composed }) =>
      q.scored !== false &&
      (q.mandatory !== false || course.rules?.optionalScoring !== "exclude") &&
      (q.mandatory !== false ||
        course.rules?.unansweredScoring !== "exclude-optional" ||
        (composed
          ? !!state.composer?.answers[q.id]
          : state.passed.includes(index) || state.penalized.includes(index))),
  );
  const score = questions.length
    ? Math.round(
        (questions.reduce(
          (n, { question: q, index, composed }) =>
            n +
            (composed
              ? (state.composer?.answers[q.id]?.credit ?? 0) / 10000
              : state.passed.includes(index)
                ? 1
                : (state.multi?.[index]?.credit ?? 0) / 10000),
          0,
        ) /
          questions.length) *
          100,
      )
    : 100;
  const required = slides.filter(
    (s) => !s.composition || s.composition.completion.required,
  );
  const complete = (slide: (typeof slides)[number]) =>
    slide.composition
      ? composerComplete(slide, state, slides.indexOf(slide))
      : state.visited.includes(slides.indexOf(slide)) &&
        (!isQuestion(slide) ||
          slide.mandatory === false ||
          state.passed.includes(slides.indexOf(slide)));
  const eligible =
    slides.length > 0 &&
    state.visited.length > 0 &&
    required.every(complete) &&
    state.life > 0;
  return {
    eligible,
    score,
    success: score >= (course.rules?.passScore ?? 80),
    assessmentComplete:
      questions.length > 0 &&
      questions.every(({ question: q, index, composed }) =>
        composed
          ? !!state.composer?.answers[q.id]
          : state.passed.includes(index) || state.penalized.includes(index),
      ),
    progress: required.length
      ? required.filter((s) =>
          s.composition
            ? complete(s)
            : state.visited.includes(slides.indexOf(s)),
        ).length / required.length
      : state.visited.length
        ? 1
        : 0,
  };
}
function award(course: CourseData, state: LearnerGameState) {
  const slides = flatten(course);
  const completed = course.levels.flatMap((_, l) => {
    const entries = slides.flatMap((s, i) => (s.levelIndex === l ? [i] : []));
    return entries.length &&
      entries.every((i) =>
        slides[i].composition
          ? !slides[i].composition!.completion.required ||
            composerComplete(slides[i], state, i)
          : state.visited.includes(i) &&
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
  if (!canNavigate(course, state, index)) return state;
  if (state.finished) return { ...state, index };
  let next = {
    ...state,
    index,
    visited: [...new Set([...state.visited, index])],
  };
  if (slides[index].composition && !state.visited.includes(index))
    next = composerEvent(slides[index], next, { event: "enter" }).state;
  return award(course, next);
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
  if (slide?.composition)
    return finishComposerEvent(course, submitComposer(slide, state, result));
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
    ...(state.composer
      ? { composer: resetComposerLevel(course, state, level) }
      : {}),
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

function finishComposerEvent(
  course: CourseData,
  result: { state: LearnerGameState; target?: string },
) {
  let next = award(course, result.state);
  if (result.target) {
    const index = flatten(course).findIndex((s) => s.id === result.target);
    if (canNavigate(course, next, index)) next = visit(course, next, index);
  }
  return next;
}
export function activateBlock(
  course: CourseData,
  state: LearnerGameState,
  id: string,
) {
  return finishComposerEvent(
    course,
    activateComposer(flatten(course)[state.index], state, id),
  );
}
export function retryActivity(
  course: CourseData,
  state: LearnerGameState,
  id: string,
) {
  return finishComposerEvent(
    course,
    retryComposer(flatten(course)[state.index], state, id),
  );
}
export function recoverBlock(
  course: CourseData,
  state: LearnerGameState,
  id: string,
) {
  return award(
    course,
    recoverComposer(flatten(course)[state.index], state, id),
  );
}
export function dismissFeedback(state: LearnerGameState, id: string) {
  if (!state.composer) return state;
  return {
    ...state,
    composer: {
      ...state.composer,
      feedback: state.composer.feedback.filter((key) => key !== id),
    },
  };
}

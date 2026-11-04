import { z } from "zod";
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
      s.kind === "single-choice" &&
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
      s.kind !== "single-choice" ||
      s.mandatory === false ||
      state.passed.includes(i),
  );
  const visited = slides.every((_, i) => state.visited.includes(i));
  const score = questions.length
    ? Math.round(
        (questions.filter((i) => state.passed.includes(i)).length /
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
          (slides[i].kind !== "single-choice" ||
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
  if (
    state.finished ||
    !slide ||
    slide.kind !== "single-choice" ||
    state.life === 0 ||
    !slide.options.some((o) => o.id === answer)
  )
    return state;
  if (answer === slide.correctId)
    return award(course, {
      ...state,
      passed: [...new Set([...state.passed, state.index])],
    });
  if (state.penalized.includes(state.index)) return state;
  return {
    ...state,
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
    finished: false,
  };
}
export function finishGame(course: CourseData, state: LearnerGameState) {
  return assessment(course, state).eligible
    ? { ...state, finished: true }
    : state;
}

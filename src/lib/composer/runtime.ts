/** Composer transitions are part of the shared game engine, never UI policies. */
import type { CourseData, Slide } from "../course";
import type { LearnerGameState } from "../game";
import {
  normalizeSubmission,
  selectionIds,
  type SubmissionResult,
} from "../interactions";
import type { Block, ComposerEvent } from "./schema";
import { questionSlide } from "./model";
import { emptyComposer } from "./state";
const add = (items: string[], id: string) =>
  items.includes(id) ? items : [...items, id];
export function blockVisible(block: Block, state: LearnerGameState) {
  return block.kind === "feedback"
    ? !!state.composer?.feedback.includes(block.id)
    : (state.composer?.visibility[block.id] ?? block.visible);
}
export function composerComplete(
  slide: Slide,
  state: LearnerGameState,
  index: number,
) {
  const c = slide.composition;
  if (!c) return state.visited.includes(index);
  if (!state.visited.includes(index) || state.life <= 0) return false;
  const required = c.blocks.filter(
    (b) =>
      b.kind === "interaction" &&
      (b.question.mandatory || c.completion.interactionIds.includes(b.id)),
  );
  if (required.some((b) => !state.composer?.answers[b.id]?.passed))
    return false;
  if (
    c.blocks.some(
      (b) =>
        b.required &&
        b.kind !== "interaction" &&
        !state.composer?.seen.includes(b.id),
    )
  )
    return false;
  return (
    c.completion.mode !== "manual" ||
    !!state.composer?.manual.includes(slide.id)
  );
}
export function canNavigate(
  course: CourseData,
  state: LearnerGameState,
  index: number,
) {
  const slides = course.levels.flatMap((l) => l.slides);
  if (index < 0 || index >= slides.length || state.life === 0) return false;
  if (state.finished || index <= state.index) return true;
  for (let i = state.index; i < index; i++)
    if (
      slides[i].composition?.navigation === "after-completion" &&
      !composerComplete(slides[i], state, i)
    )
      return false;
  return true;
}
export function composerEvent(
  slide: Slide,
  state: LearnerGameState,
  event: ComposerEvent,
): { state: LearnerGameState; target?: string } {
  const c = slide.composition;
  if (!c || state.finished) return { state };
  let runtime = state.composer ?? emptyComposer();
  let target: string | undefined;
  if (event.event === "enter") {
    runtime = {
      ...runtime,
      seen: [
        ...new Set([
          ...runtime.seen,
          ...c.blocks
            .filter(
              (b) =>
                b.kind !== "feedback" &&
                blockVisible(b, { ...state, composer: runtime }),
            )
            .map((b) => b.id),
        ]),
      ],
    };
  }
  for (const rule of c.rules) {
    if (
      rule.trigger.event !== event.event ||
      rule.trigger.sourceId !== event.sourceId
    )
      continue;
    for (const action of rule.actions) {
      if (action.type === "show")
        runtime = {
          ...runtime,
          visibility: { ...runtime.visibility, [action.targetId]: true },
          seen: add(runtime.seen, action.targetId),
        };
      if (action.type === "hide")
        runtime = {
          ...runtime,
          visibility: { ...runtime.visibility, [action.targetId]: false },
          feedback: runtime.feedback.filter((id) => id !== action.targetId),
        };
      if (action.type === "feedback")
        runtime = {
          ...runtime,
          feedback: add(runtime.feedback, action.targetId),
        };
      if (action.type === "complete")
        runtime = { ...runtime, manual: add(runtime.manual, slide.id) };
      if (action.type === "navigate") target = action.slideId;
      // record-result intentionally reaffirms the normalized engine result. It
      // cannot award arbitrary points or duplicate a life penalty.
    }
  }
  return { state: { ...state, composer: runtime }, target };
}
function feedbackFor(
  slide: Slide,
  state: LearnerGameState,
  interactionId: string,
  last: "correct" | "incorrect" | "partial" | "retry",
) {
  const c = slide.composition!,
    runtime = state.composer ?? emptyComposer();
  const owned = new Set(
    c.blocks
      .filter((b) => b.kind === "feedback" && b.interactionId === interactionId)
      .map((b) => b.id),
  );
  const matching = c.blocks
    .filter(
      (b) =>
        b.kind === "feedback" &&
        b.interactionId === interactionId &&
        b.condition === last,
    )
    .map((b) => b.id);
  return {
    ...state,
    composer: {
      ...runtime,
      feedback: [
        ...runtime.feedback.filter((id) => !owned.has(id)),
        ...matching,
      ],
    },
  };
}
export function submitComposer(
  slide: Slide,
  state: LearnerGameState,
  result: SubmissionResult | null,
) {
  const b = slide.composition?.blocks.find(
    (b) => b.kind === "interaction" && b.id === result?.slideId,
  );
  if (
    state.finished ||
    state.life === 0 ||
    !b ||
    b.kind !== "interaction" ||
    !result ||
    !blockVisible(b, state)
  )
    return { state };
  const question = questionSlide(slide, b),
    checked = normalizeSubmission(
      question,
      selectionIds(question, result.selection),
    );
  if (
    !checked ||
    checked.kind !== result.kind ||
    checked.selection !== result.selection ||
    checked.credit !== result.credit ||
    checked.correct !== result.correct
  )
    return { state };
  const runtime = state.composer ?? emptyComposer(),
    old = runtime.answers[b.id];
  const last = result.correct
    ? "correct"
    : result.credit > 0
      ? "partial"
      : "incorrect";
  const entry = {
    selection: result.selection,
    credit: Math.max(old?.credit ?? 0, result.credit),
    passed: !!old?.passed || result.correct,
    penalized: !!old?.penalized || !result.correct,
    last,
  } as const;
  let next: LearnerGameState = {
    ...state,
    life:
      !result.correct && !old?.penalized
        ? Math.max(0, state.life - b.question.lifePenalty)
        : state.life,
    composer: { ...runtime, answers: { ...runtime.answers, [b.id]: entry } },
  };
  next = feedbackFor(slide, next, b.id, last);
  return composerEvent(slide, next, { event: last, sourceId: b.id });
}
export function retryComposer(
  slide: Slide,
  state: LearnerGameState,
  id: string,
) {
  const b = slide.composition?.blocks.find((b) => b.id === id);
  const old = state.composer?.answers[id];
  if (
    state.finished ||
    !old ||
    b?.kind !== "interaction" ||
    !blockVisible(b, state) ||
    state.life === 0
  )
    return { state };
  const runtime = state.composer!;
  const next = feedbackFor(
    slide,
    {
      ...state,
      composer: {
        ...runtime,
        answers: {
          ...runtime.answers,
          [id]: { ...old, selection: 0, last: "retry" },
        },
      },
    },
    id,
    "retry",
  );
  return composerEvent(slide, next, { event: "retry", sourceId: id });
}
export function activateComposer(
  slide: Slide,
  state: LearnerGameState,
  id: string,
) {
  const b = slide.composition?.blocks.find((b) => b.id === id);
  return !state.finished &&
    state.life > 0 &&
    b?.kind === "button" &&
    blockVisible(b, state)
    ? composerEvent(slide, state, { event: "activate", sourceId: id })
    : { state };
}
export function recoverComposer(
  slide: Slide,
  state: LearnerGameState,
  id: string,
) {
  const b = slide.composition?.blocks.find((b) => b.id === id),
    runtime = state.composer ?? emptyComposer();
  if (
    state.finished ||
    state.life === 0 ||
    b?.kind !== "recovery" ||
    !blockVisible(b, state) ||
    runtime.recovered.includes(id)
  )
    return state;
  return {
    ...state,
    life: Math.min(100, state.life + b.amount),
    composer: { ...runtime, recovered: add(runtime.recovered, id) },
  };
}
export function resetComposerLevel(
  course: CourseData,
  state: LearnerGameState,
  level: number,
) {
  if (!state.composer) return undefined;
  const slides = course.levels[level].slides,
    slideIds = new Set(slides.map((s) => s.id)),
    ids = new Set(
      slides.flatMap((s) => s.composition?.blocks.map((b) => b.id) ?? []),
    ),
    old = state.composer;
  return {
    answers: Object.fromEntries(
      Object.entries(old.answers).filter(([id]) => !ids.has(id)),
    ),
    visibility: Object.fromEntries(
      Object.entries(old.visibility).filter(([id]) => !ids.has(id)),
    ),
    seen: old.seen.filter((id) => !ids.has(id)),
    manual: old.manual.filter((id) => !slideIds.has(id)),
    feedback: old.feedback.filter((id) => !ids.has(id)),
    recovered: old.recovered.filter((id) => !ids.has(id)),
  };
}
export function validateComposerResume(
  course: CourseData,
  state: LearnerGameState,
) {
  if (!state.composer) {
    if (
      course.levels
        .flatMap((l) => l.slides)
        .some((s, i) => s.composition && state.visited.includes(i))
    )
      throw Error("Composer resume state is missing");
    return;
  }
  const slides = course.levels.flatMap((l) => l.slides),
    all = slides.flatMap(
      (s) => s.composition?.blocks.map((b) => ({ slide: s, block: b })) ?? [],
    ),
    map = new Map(all.map((x) => [x.block.id, x]));
  const r = state.composer;
  for (const [id, answer] of Object.entries(r.answers)) {
    const found = map.get(id);
    if (found?.block.kind !== "interaction")
      throw Error("Resume refers to a missing interaction");
    const question = questionSlide(found.slide, found.block),
      result = normalizeSubmission(
        question,
        selectionIds(question, answer.selection),
      );
    const count = (question.correctIds ?? question.options).length;
    const allowed =
      (question.kind === "multi-select" || question.kind === "sequencing") &&
      question.scoringMode === "partial-credit"
        ? Array.from({ length: count + 1 }, (_, i) =>
            Math.round((i / count) * 10000),
          )
        : [0, 10000];
    if (
      !allowed.includes(answer.credit) ||
      answer.passed !== (answer.credit === 10000) ||
      (!answer.passed && !answer.penalized)
    )
      throw Error("Invalid composer resume credit");
    if (answer.last === "retry") {
      if (answer.selection !== 0) throw Error("Invalid retry selection");
    } else if (
      !result ||
      result.selection !== answer.selection ||
      result.credit > answer.credit ||
      answer.last !==
        (result.correct
          ? "correct"
          : result.credit > 0
            ? "partial"
            : "incorrect") ||
      (!result.correct && !answer.penalized)
    )
      throw Error("Invalid composer resume selection");
  }
  for (const [id, visible] of Object.entries(r.visibility)) {
    if (!map.has(id)) throw Error("Unknown visibility reference");
    const owner = map.get(id)!.slide;
    if (
      !owner.composition!.rules.some((rule) =>
        rule.actions.some(
          (a) =>
            a.type === (visible ? "show" : "hide") &&
            "targetId" in a &&
            a.targetId === id,
        ),
      )
    )
      throw Error("Impossible visibility state");
  }
  for (const id of r.seen)
    if (!map.has(id) || map.get(id)!.block.kind === "feedback")
      throw Error("Unknown viewed block");
  for (const id of r.manual)
    if (
      !slides.some(
        (s) =>
          s.id === id &&
          s.composition?.rules.some((rule) =>
            rule.actions.some((a) => a.type === "complete"),
          ),
      )
    )
      throw Error("Unknown completed slide");
  for (const id of r.recovered)
    if (map.get(id)?.block.kind !== "recovery")
      throw Error("Unknown recovery block");
  for (const id of r.feedback) {
    const b = map.get(id)?.block;
    if (
      b?.kind !== "feedback" ||
      r.answers[b.interactionId]?.last !== b.condition
    )
      throw Error("Invalid feedback owner or condition");
  }
}

export function completeVideo(
  slide: Slide,
  state: LearnerGameState,
  blockId: string,
): { state: LearnerGameState; target?: string } {
  const b = slide.composition?.blocks.find((b) => b.id === blockId);
  if (!b || b.kind !== "video") return { state };
  const runtime = state.composer ?? emptyComposer();
  const next = {
    ...state,
    composer: {
      ...runtime,
      seen: add(runtime.seen, blockId),
    },
  };
  return composerEvent(slide, next, { event: "video-complete", sourceId: blockId });
}

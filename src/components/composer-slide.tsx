"use client";
/* eslint-disable @next/next/no-img-element -- embedded/local lesson media */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { CourseData, Slide } from "@/lib/course";
import type { Block, InteractionBlock } from "@/lib/composer/schema";
import { questionSlide } from "@/lib/composer/model";
import { blockVisible, composerComplete } from "@/lib/composer/runtime";
import { normalizeSubmission, selectionIds } from "@/lib/interactions";
import {
  activateBlock,
  dismissFeedback,
  recoverBlock,
  retryActivity,
  submitQuestion,
  type LearnerGameState,
} from "@/lib/game";
import { Modal } from "./ui";
export function ComposerSlide({
  course,
  slide,
  state,
  onChange,
}: {
  course: CourseData;
  slide: Slide;
  state: LearnerGameState;
  onChange: Dispatch<SetStateAction<LearnerGameState>>;
}) {
  const composition = slide.composition!;
  const container = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const visible = composition.blocks.filter((b) => blockVisible(b, state));
  const dialogs = visible.filter(
    (b): b is Extract<Block, { kind: "feedback" }> =>
      b.kind === "feedback" && b.presentation !== "inline",
  );
  const dialog = dialogs[0];
  const visibilityKey = visible.map((b) => b.id).join("|");
  useEffect(() => {
    if (!dialog && origin.current && !origin.current.isConnected)
      container.current
        ?.querySelector<HTMLElement>(
          "button:not([disabled]),input:not([disabled])",
        )
        ?.focus();
  }, [visibilityKey, dialog]);
  const remember = () => {
    origin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  };
  function render(block: Block) {
    switch (block.kind) {
      case "content":
        return (
          <section className="composer-content">
            <p>{block.text}</p>
          </section>
        );
      case "media":
        return (
          <figure className="composer-media">
            <img src={block.src} alt={block.alt} />
          </figure>
        );
      case "interaction":
        return (
          <ComposerQuestion
            block={block}
            slide={slide}
            state={state}
            onSubmit={(ids) => {
              remember();
              const result = normalizeSubmission(
                questionSlide(slide, block),
                ids,
              );
              onChange((s) => submitQuestion(course, s, result));
            }}
            onRetry={() => {
              remember();
              onChange((s) => retryActivity(course, s, block.id));
            }}
          />
        );
      case "feedback":
        return block.presentation === "inline" ? (
          <section
            role="status"
            className="feedback"
            aria-label={`${block.condition} feedback`}
          >
            <p>{block.text}</p>
            <button
              className="composer-dismiss"
              onClick={() => onChange((s) => dismissFeedback(s, block.id))}
            >
              Dismiss feedback
            </button>
          </section>
        ) : null;
      case "button":
        return (
          <button
            className="learner-primary"
            disabled={state.finished || state.life === 0}
            onClick={() => {
              remember();
              onChange((s) => activateBlock(course, s, block.id));
            }}
          >
            {block.label}
          </button>
        );
      case "recovery":
        return (
          <button
            className="learner-primary"
            disabled={
              state.finished ||
              state.life === 0 ||
              state.composer?.recovered.includes(block.id)
            }
            onClick={() => onChange((s) => recoverBlock(course, s, block.id))}
          >
            Restore {block.amount}% life
          </button>
        );
    }
  }
  return (
    <div ref={container} className="composer-surface">
      <div
        className={`composer-regions composer-${composition.layout.variant}`}
      >
        {composition.layout.regions.map((region) => (
          <section
            className="composer-region"
            key={region}
            aria-label={`Region ${region}`}
          >
            {visible
              .filter(
                (b) =>
                  b.region === region &&
                  !(b.kind === "feedback" && b.presentation !== "inline"),
              )
              .map((block) => (
                <div
                  className="composer-block"
                  data-block-id={block.id}
                  key={block.id}
                >
                  {render(block)}
                </div>
              ))}
          </section>
        ))}
      </div>
      <p className="composer-completion" role="status">
        {composerComplete(slide, state, state.index)
          ? "Slide complete"
          : "Slide incomplete"}
        {!composition.completion.required ? " · Optional slide" : ""}
      </p>
      {dialog && (
        <Modal
          key={dialog.id}
          open
          onOpenChange={(open) => {
            if (!open) onChange((s) => dismissFeedback(s, dialog.id));
          }}
          title={`${dialog.condition[0].toUpperCase() + dialog.condition.slice(1)} feedback`}
          description="Feedback for the activity you submitted."
          contentClassName={`composer-feedback-modal ${dialog.presentation === "overlay" ? "composer-feedback-overlay" : ""}`}
          contentStyle={{
            background: course.theme.card,
            color: course.theme.text,
            fontFamily: course.theme.font,
            borderColor: course.theme.border,
          }}
          onCloseFocus={() => {
            if (dialogs.length === 1) {
              const source = [
                ...(container.current?.querySelectorAll<HTMLElement>(
                  "[data-composer-submit]",
                ) ?? []),
              ].find(
                (el) => el.dataset.composerSubmit === dialog.interactionId,
              );
              if (origin.current?.isConnected) origin.current.focus();
              else if (source) source.focus();
              else
                container.current
                  ?.closest("article")
                  ?.querySelector<HTMLElement>("h1")
                  ?.focus();
            }
          }}
        >
          <p>{dialog.text}</p>
          <button
            className="learner-primary"
            style={{
              background: course.theme.primary,
              color: course.theme.buttonText,
            }}
            onClick={() => onChange((s) => dismissFeedback(s, dialog.id))}
          >
            Continue lesson
          </button>
        </Modal>
      )}
    </div>
  );
}
function ComposerQuestion({
  block,
  slide,
  state,
  onSubmit,
  onRetry,
}: {
  block: InteractionBlock;
  slide: Slide;
  state: LearnerGameState;
  onSubmit: (ids: string[]) => void;
  onRetry: () => void;
}) {
  const q = questionSlide(slide, block),
    answer = state.composer?.answers[block.id],
    help = useId();
  const [draft, setDraft] = useState(() =>
    selectionIds(q, answer?.selection ?? 0),
  );
  useEffect(() => {
    setDraft(selectionIds(q, answer?.selection ?? 0)); // Hydrate only this interaction's submitted state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer?.selection, answer?.last]);
  const disabled = state.finished || state.life === 0;
  return (
    <section className="composer-question" aria-label={block.question.prompt}>
      <h3>{block.question.prompt}</h3>
      <p id={help}>
        {q.kind === "multi-select"
          ? "Select one or more answers."
          : "Choose one answer."}{" "}
        {block.question.mandatory
          ? "An exact correct submission is required for completion."
          : "Optional for completion."}{" "}
        {block.question.scored ? "Scored activity." : "Unscored activity."}
      </p>
      <fieldset className="answer-options" aria-describedby={help}>
        <legend>
          {q.kind === "multi-select"
            ? "Choose one or more answers"
            : "Choose one answer"}
        </legend>
        {q.options.map((option) => (
          <label
            key={option.id}
            className={draft.includes(option.id) ? "chosen" : ""}
          >
            <input
              type={q.kind === "multi-select" ? "checkbox" : "radio"}
              name={`answer-${block.id}`}
              value={option.id}
              checked={draft.includes(option.id)}
              disabled={disabled}
              onChange={(e) =>
                setDraft(
                  q.kind === "single-choice"
                    ? [option.id]
                    : e.target.checked
                      ? [...draft, option.id]
                      : draft.filter((id) => id !== option.id),
                )
              }
            />
            {option.text}
            {option.image && (
              <img
                className="answer-image"
                src={option.image}
                alt={option.imageAlt ?? ""}
              />
            )}
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button
          className="learner-primary"
          disabled={disabled || !draft.length}
          data-composer-submit={block.id}
          onClick={() => onSubmit(draft)}
        >
          Submit activity
        </button>
        <button
          className="composer-retry"
          disabled={disabled || !answer}
          onClick={onRetry}
        >
          Retry activity
        </button>
      </div>
      {answer && (
        <p role="status">
          Best credit: {answer.credit / 100}% ·{" "}
          {answer.passed ? "Competency met" : "Competency not yet met"}
        </p>
      )}
    </section>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element -- embedded/local lesson media */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
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
  completeVideoBlock,
  type LearnerGameState,
} from "@/lib/game";
import { Modal } from "./ui";
import { VideoPlayer } from "./video-player";
import { SequencingPlayer } from "./sequencing-player";
import {
  CharacterTrio,
  ScenarioMachineGuardImage,
  ScenarioAssemblyLineImage,
  IconInjury,
  IconDamage,
  IconProduction,
  IconEnvironment,
  IconFinancial,
  IconApexCommittee,
  IconSubCommittee,
  IconAdHoc,
} from "./game-assets";

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
  const isGameMode =
    course.theme.style === "game" || !!composition.scene?.preset;
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
      case "content": {
        const variant = block.contentVariant || "standard";
        if (variant === "speech-bubble") {
          return (
            <div
              className={`game-speech-bubble-wrapper tail-${block.bubbleTail || "left"}`}
            >
              {block.speaker && (
                <div className="speech-speaker-badge">
                  <Sparkles className="badge-sparkle" />
                  <span>{block.speaker}</span>
                </div>
              )}
              <div className="game-speech-bubble">
                <p>{block.text}</p>
                <div className="speech-bubble-tail" aria-hidden="true" />
              </div>
            </div>
          );
        }
        if (variant === "scenario-panel") {
          return (
            <div className="game-scenario-card">
              <div className="scenario-badge-ribbon">
                <span className="ribbon-icon">🎬</span>
                <span>{block.title || "The Scenario"}</span>
              </div>
              <div className="scenario-card-body">
                <p>{block.text}</p>
              </div>
            </div>
          );
        }
        if (variant === "heading-banner") {
          return (
            <div className="game-heading-banner">
              <div className="banner-accent-stripe" />
              <h2>{block.title || block.text}</h2>
            </div>
          );
        }
        return (
          <section className="composer-content">
            {block.title && <h3>{block.title}</h3>}
            <p>{block.text}</p>
          </section>
        );
      }
      case "character":
        return (
          <div
            className={`game-character-display ${block.flip ? "flipped" : ""}`}
            role="img"
            aria-label={block.alt}
          >
            {block.customSrc ? (
              <img
                src={block.customSrc}
                alt={block.alt}
                className="character-raster"
              />
            ) : (
              <CharacterTrio className="character-svg" />
            )}
          </div>
        );
      case "video":
        return (
          <VideoPlayer
            block={block}
            onComplete={() => {
              onChange((s) => completeVideoBlock(course, s, block.id));
            }}
          />
        );
      case "media":
        return (
          <figure className="composer-media">
            {block.src === "asset:scenario-machine-guard" ? (
              <ScenarioMachineGuardImage className="scenario-svg-preview" />
            ) : block.src === "asset:scenario-assembly-line" ? (
              <ScenarioAssemblyLineImage className="scenario-svg-preview" />
            ) : (
              <img src={block.src} alt={block.alt} />
            )}
            {block.caption && <figcaption>{block.caption}</figcaption>}
          </figure>
        );
      case "interaction":
        if (block.question.kind === "sequencing") {
          return (
            <SequencingPlayer
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
        }
        return (
          <ComposerQuestion
            block={block}
            slide={slide}
            state={state}
            isGameMode={isGameMode}
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
            className={`feedback ${isGameMode ? "game-feedback-card" : ""} ${block.condition}`}
            aria-label={`${block.condition} feedback`}
          >
            <div className="feedback-content">
              <strong>
                {block.condition === "correct"
                  ? "🎉 Correct!"
                  : block.condition === "partial"
                    ? "⚖️ Partial credit"
                    : block.condition === "retry"
                      ? "🔄 Retry"
                      : "⚠️ Review needed"}
              </strong>
              <p>{block.text}</p>
            </div>
            <button
              className="composer-dismiss"
              onClick={() => onChange((s) => dismissFeedback(s, block.id))}
            >
              Dismiss
            </button>
          </section>
        ) : null;
      case "button":
        return (
          <button
            className={`learner-primary ${block.buttonVariant === "game" || isGameMode ? "game-action-btn" : ""}`}
            disabled={state.finished || state.life === 0}
            onClick={() => {
              remember();
              onChange((s) => activateBlock(course, s, block.id));
            }}
          >
            <span>{block.label}</span>
            <ArrowRight className="btn-arrow" />
          </button>
        );
      case "recovery":
        return (
          <button
            className={`learner-primary ${isGameMode ? "game-action-btn" : ""}`}
            disabled={
              state.finished ||
              state.life === 0 ||
              state.composer?.recovered.includes(block.id)
            }
            onClick={() => onChange((s) => recoverBlock(course, s, block.id))}
          >
            <span>Restore {block.amount}% life</span>
          </button>
        );
    }
  }

  return (
    <div
      ref={container}
      className={`composer-surface ${isGameMode ? "game-mode" : ""} ${composition.scene?.preset ? `scene-${composition.scene.preset}` : ""}`}
    >
      {/* Optional Top Title Banner in Scene */}
      {composition.scene?.titleBanner && (
        <div className="game-scene-title-banner">
          <div className="banner-diagonal-bar" />
          <h1>{composition.scene.titleBanner}</h1>
        </div>
      )}

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
            className={`learner-primary ${isGameMode ? "game-action-btn" : ""}`}
            style={{
              background: course.theme.primary,
              color: course.theme.buttonText,
            }}
            onClick={() => onChange((s) => dismissFeedback(s, dialog.id))}
          >
            <span>Continue lesson</span>
            <ArrowRight className="btn-arrow" />
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
  isGameMode,
  onSubmit,
  onRetry,
}: {
  block: InteractionBlock;
  slide: Slide;
  state: LearnerGameState;
  isGameMode?: boolean;
  onSubmit: (ids: string[]) => void;
  onRetry: () => void;
}) {
  const q = useMemo(() => questionSlide(slide, block), [slide, block]),
    answer = state.composer?.answers[block.id],
    help = useId();
  const [draft, setDraft] = useState(() =>
    selectionIds(q, answer?.selection ?? 0),
  );
  useEffect(() => {
    setDraft(selectionIds(q, answer?.selection ?? 0));
  }, [answer?.selection, answer?.last, block.id, q]);
  const disabled = state.finished || state.life === 0;

  function renderOptionIcon(id: string) {
    if (id === "injury" || id === "opt-1")
      return <IconInjury className="card-custom-icon" />;
    if (id === "damage" || id === "opt-2")
      return <IconDamage className="card-custom-icon" />;
    if (id === "production" || id === "opt-3")
      return <IconProduction className="card-custom-icon" />;
    if (id === "environment" || id === "opt-4")
      return <IconEnvironment className="card-custom-icon" />;
    if (id === "financial" || id === "opt-5")
      return <IconFinancial className="card-custom-icon" />;
    if (id === "apex" || id === "comm-1")
      return <IconApexCommittee className="card-custom-icon" />;
    if (id === "sub" || id === "comm-2")
      return <IconSubCommittee className="card-custom-icon" />;
    if (id === "adhoc" || id === "comm-3")
      return <IconAdHoc className="card-custom-icon" />;
    return null;
  }

  return (
    <section
      className={`composer-question ${isGameMode ? "game-card-question" : ""}`}
      aria-label={block.question.prompt}
    >
      <h3 className="question-prompt-text">{block.question.prompt}</h3>
      <p id={help} className="question-instruction-text">
        {q.kind === "multi-select"
          ? "Select all that apply, then submit."
          : "Choose one answer."}{" "}
        {block.question.mandatory
          ? "An exact correct submission is required for completion."
          : "Optional for completion."}{" "}
        {block.question.scored ? "Scored activity." : "Unscored activity."}
      </p>
      <fieldset className="answer-options" aria-describedby={help}>
        <legend className="sr-only">
          {q.kind === "multi-select"
            ? "Choose one or more answers"
            : "Choose one answer"}
        </legend>
        <div
          className={`answer-cards-grid ${isGameMode ? "game-cards-layout" : ""}`}
        >
          {q.options.map((option) => (
            <label
              key={option.id}
              className={`answer-card ${draft.includes(option.id) ? "chosen" : ""}`}
            >
              <div className="card-header-row">
                {renderOptionIcon(option.id)}
                <input
                  type={q.kind === "multi-select" ? "checkbox" : "radio"}
                  name={`answer-${block.id}`}
                  value={option.id}
                  checked={draft.includes(option.id)}
                  disabled={disabled}
                  className="card-choice-input"
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
              </div>
              <span className="card-label-text">{option.text}</span>
              {option.image && (
                <img
                  className="answer-image"
                  src={option.image}
                  alt={option.imageAlt ?? ""}
                />
              )}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="actions question-actions-row">
        <button
          className={
            isGameMode
              ? "game-submit-btn"
              : "learner-primary"
          }
          disabled={disabled || !draft.length}
          data-composer-submit={block.id}
          aria-label="Submit activity"
          onClick={() => onSubmit(draft)}
        >
          <span>Submit</span>
          <ArrowRight className="submit-chevron" />
        </button>
        <button
          className={
            isGameMode ? "game-retry-btn" : "composer-retry"
          }
          disabled={disabled || !answer}
          onClick={onRetry}
        >
          <RotateCcw className="retry-icon" />
          <span>Retry activity</span>
        </button>
      </div>
      {answer && (
        <p
          role="status"
          className={`question-status-note ${answer.passed ? "passed" : "pending"}`}
        >
          Best credit: {answer.credit / 100}% ·{" "}
          {answer.passed ? "Competency met" : "Competency not yet met"}
        </p>
      )}
    </section>
  );
}

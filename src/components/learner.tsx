"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded data URLs render without image optimization */
import { useState, useEffect, useRef, useId, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Layers,
  Star,
} from "lucide-react";
import {
  isQuestion,
  normalizeSubmission,
  selectionIds,
  type SubmissionResult,
} from "@/lib/interactions";
import { ComposerSlide } from "./composer-slide";
import { canNavigate } from "@/lib/composer/runtime";
import { type CourseData } from "@/lib/course";
import {
  initialGame,
  visit,
  submitQuestion,
  recoverLife,
  retryLevel,
  finishGame,
  assessment,
} from "@/lib/game";
import {
  discoverApi,
  Scorm12Adapter,
  Scorm2004Adapter,
} from "@/lib/scorm/adapters";
import { ScormSessionManager } from "@/lib/scorm/session";
import type { ScormVersion } from "@/lib/scorm/types";
export function Learner({
  course,
  onClose,
  tracking,
}: {
  course: CourseData;
  onClose: () => void;
  tracking?: { version: ScormVersion; fingerprint: string };
}) {
  const slides = course.levels.flatMap((l) =>
    l.slides.map((s) => ({ ...s, levelTitle: l.title })),
  );
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [game, setGame] = useState(() => visit(course, initialGame(), 0));
  const [answer, setAnswer] = useState(""),
    [feedback, setFeedback] = useState<SubmissionResult | null>(null),
    [multiDraft, setMultiDraft] = useState<{
      slideId: string;
      ids: string[];
    } | null>(null),
    [trackingError, setTrackingError] = useState(""),
    [ready, setReady] = useState(!tracking),
    [reviewing, setReviewing] = useState(false),
    [completionSaved, setCompletionSaved] = useState(false);
  const instructionId = useId();
  const manager = useRef<ScormSessionManager | null>(null),
    latest = useRef(game);
  const pendingSave = useRef(false);
  latest.current = game;
  const index = game.index;
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);
  function persist() {
    if (!manager.current) return;
    pendingSave.current = true;
    try {
      manager.current.save(latest.current);
      pendingSave.current = false;
      setCompletionSaved(latest.current.finished);
      setTrackingError("");
    } catch (e) {
      setCompletionSaved(false);
      setTrackingError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!tracking) return;
    try {
      const api = discoverApi(tracking.version);
      if (!api)
        throw new Error(
          "LMS API unavailable. Practice only: progress is not saved.",
        );
      const adapter =
        tracking.version === "1.2"
          ? new Scorm12Adapter(api)
          : new Scorm2004Adapter(api);
      const session = new ScormSessionManager(
        adapter,
        course,
        tracking.fingerprint,
      );
      const restored = session.initialize();
      manager.current = session;
      setReviewing(session.isReviewOnly);
      setGame(visit(course, restored, restored.index));
    } catch (e) {
      setTrackingError((e as Error).message);
    }
    setReady(true);
    const exit = (event: PageTransitionEvent) => {
      if (event.persisted) {
        persist();
        return;
      }
      try {
        manager.current?.terminate(latest.current);
      } catch (e) {
        setTrackingError((e as Error).message);
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (pendingSave.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnUnsaved);
    const timer = window.setInterval(persist, 15000);
    window.addEventListener("pagehide", exit);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", warnUnsaved);
      window.removeEventListener("pagehide", exit);
      document.removeEventListener("visibilitychange", hidden);
    };
    // The package/course is immutable for the lifetime of one learner session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ready && tracking) persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, ready]);
  const slide = slides[index],
    t = course.theme;
  const style = {
    "--l-bg": t.background,
    "--l-section": t.section,
    "--l-header": t.header,
    "--l-nav": t.navigation,
    "--l-text": t.text,
    "--l-muted": t.muted,
    "--l-primary": t.primary,
    "--l-button-text": t.buttonText,
    "--l-border": t.border,
    "--l-card": t.card,
    "--l-icon": t.icon,
    "--l-life": t.life,
    "--l-star": t.star,
    "--l-radius": `${t.radius}px`,
    fontFamily: t.font,
    fontSize: t.fontSize,
    backgroundImage: t.backgroundImage
      ? `url("${t.backgroundImage}")`
      : undefined,
  } as CSSProperties;
  const multiAnswers =
    slide?.kind === "multi-select"
      ? multiDraft?.slideId === slide.id
        ? multiDraft.ids
        : selectionIds(slide, game.multi?.[index]?.selection ?? 0)
      : [];
  function go(i: number) {
    setGame((g) => visit(course, g, i));
    setAnswer("");
    setMultiDraft(null);
    setFeedback(null);
  }
  return (
    <div className="learner" style={style}>
      <div className="preview-bar">
        <span>
          LEARNER PREVIEW <span>· Temporary session</span>
        </span>
        <button
          onClick={() => {
            if (tracking) {
              try {
                manager.current?.terminate(game);
              } catch (e) {
                setTrackingError((e as Error).message);
                return;
              }
            }
            onClose();
          }}
        >
          <ArrowLeft />
          {tracking ? "Save and exit" : "Back to editor"}
        </button>
      </div>
      {trackingError && (
        <div className="tracking-alert" role="alert">
          {trackingError}{" "}
          {manager.current ? (
            <button onClick={persist}>Retry LMS save</button>
          ) : (
            <span>Reload the lesson after checking the LMS launch.</span>
          )}
        </div>
      )}
      <header className="learner-header">
        <div>
          {course.header.showLogo &&
            (t.logo ? <img src={t.logo} alt="Course logo" /> : <Layers />)}
          <div>
            <strong>{course.header.title}</strong>
            <small>{course.header.subtitle}</small>
          </div>
        </div>
        {course.header.showLife && (
          <div className="life">
            <Heart />
            <span>
              Life <strong data-testid="life">{game.life}%</strong>
            </span>
            <progress value={game.life} max={100} aria-label="Life" />
          </div>
        )}
      </header>
      <div className="learner-body">
        <aside className="learner-nav">
          <small>YOUR LEARNING JOURNEY</small>
          {course.levels.map((l, levelIndex) => (
            <div key={l.id}>
              <h3>
                {l.title}{" "}
                {game.stars.includes(levelIndex) && (
                  <Star
                    className="earned-star"
                    aria-label="Level star earned"
                  />
                )}
              </h3>
              {l.slides.map((s) => {
                const i = slides.findIndex((x) => x.id === s.id);
                return (
                  <button
                    key={s.id}
                    className={i === index ? "selected" : ""}
                    disabled={!canNavigate(course, game, i)}
                    onClick={() => go(i)}
                  >
                    <span>{i + 1}</span>
                    {s.title}
                  </button>
                );
              })}
            </div>
          ))}
          {!tracking && (
            <button
              className="reset"
              onClick={() => {
                setPreviewEpoch((n) => n + 1);
                setGame(visit(course, initialGame(), 0));
                setAnswer("");
                setMultiDraft(null);
                setFeedback(null);
              }}
            >
              <RotateCcw />
              Restart preview
            </button>
          )}
        </aside>
        <section className="learner-stage">
          {slide ? (
            <>
              <div className="learner-meta">
                <span>{slide.levelTitle}</span>
                <span>
                  {index + 1} / {slides.length}
                </span>
              </div>
              <article
                className="lesson"
                style={
                  slide.background
                    ? { background: slide.background }
                    : undefined
                }
              >
                <span className="lesson-eyebrow">
                  {isQuestion(slide)
                    ? "CHECK YOUR UNDERSTANDING"
                    : "EXPLORE & LEARN"}
                </span>
                <h1 ref={headingRef} tabIndex={-1}>
                  {slide.title}
                </h1>
                {slide.composition && (
                  <ComposerSlide
                    key={`${slide.id}-${previewEpoch}-${game.attempts}`}
                    course={course}
                    slide={slide}
                    state={game}
                    onChange={setGame}
                  />
                )}
                {!slide.composition && <p>{slide.text}</p>}
                {!slide.composition && slide.image && (
                  <img
                    className="lesson-image"
                    src={slide.image}
                    alt={slide.title}
                  />
                )}{" "}
                {isQuestion(slide) && (
                  <>
                    {slide.kind === "multi-select" && (
                      <p id={instructionId} className="multi-score">
                        Select at least one answer, then submit.{" "}
                        {slide.scoringMode === "partial-credit"
                          ? "Partial credit: correct selections minus incorrect selections, divided by correct answers; minimum zero."
                          : "All-or-nothing credit: select every correct answer and no incorrect answers."}{" "}
                        {slide.mandatory !== false
                          ? "An exact answer is required for completion."
                          : "This question is optional for completion."}
                      </p>
                    )}
                    <fieldset
                      className="answer-options"
                      aria-describedby={
                        slide.kind === "multi-select"
                          ? instructionId
                          : undefined
                      }
                    >
                      <legend>
                        {slide.kind === "multi-select"
                          ? "Choose one or more answers"
                          : "Choose one answer"}
                      </legend>
                      {slide.options.map((o, i) => (
                        <label
                          className={
                            (
                              slide.kind === "multi-select"
                                ? multiAnswers.includes(o.id)
                                : answer === o.id
                            )
                              ? "chosen"
                              : ""
                          }
                          key={o.id}
                        >
                          <input
                            type={
                              slide.kind === "multi-select"
                                ? "checkbox"
                                : "radio"
                            }
                            name="answer"
                            value={o.id}
                            checked={
                              slide.kind === "multi-select"
                                ? multiAnswers.includes(o.id)
                                : answer === o.id
                            }
                            disabled={game.life === 0 || game.finished}
                            onChange={(event) => {
                              if (slide.kind === "multi-select")
                                setMultiDraft({
                                  slideId: slide.id,
                                  ids: event.target.checked
                                    ? [...multiAnswers, o.id]
                                    : multiAnswers.filter((id) => id !== o.id),
                                });
                              else setAnswer(o.id);
                              setFeedback(null);
                            }}
                          />
                          <span>{String.fromCharCode(65 + i)}</span>
                          {o.text}
                          {o.image && (
                            <img
                              className="answer-image"
                              src={o.image}
                              alt={o.imageAlt ?? ""}
                            />
                          )}
                        </label>
                      ))}
                    </fieldset>
                    <button
                      className="learner-primary"
                      disabled={
                        (slide.kind === "multi-select"
                          ? !multiAnswers.length
                          : !answer) ||
                        game.life === 0 ||
                        game.finished
                      }
                      onClick={() => {
                        const result = normalizeSubmission(
                          slide,
                          slide.kind === "multi-select"
                            ? multiAnswers
                            : [answer],
                        );
                        if (!result) return;
                        setGame((g) => submitQuestion(course, g, result));
                        setFeedback(result);
                      }}
                    >
                      Submit answer <ArrowRight />
                    </button>
                    {slide.kind === "multi-select" && game.multi?.[index] && (
                      <p className="multi-score">
                        Best earned credit for this question:{" "}
                        <strong data-testid="multi-best-credit">
                          {game.multi[index].credit / 100}%
                        </strong>
                        . Saved selections are restored after submission.
                      </p>
                    )}
                    {feedback !== null && (
                      <div role="status" className="feedback">
                        {feedback.correct ? <CheckCircle2 /> : <XCircle />}
                        <div>
                          <strong>
                            {feedback.correct
                              ? "Correct answer"
                              : feedback.credit > 0
                                ? "Partially correct"
                                : "Let’s take another look"}
                          </strong>
                          <p>
                            {feedback.correct
                              ? slide.correctFeedback
                              : feedback.credit > 0
                                ? (slide.partialFeedback ??
                                  slide.incorrectFeedback)
                                : slide.incorrectFeedback}
                          </p>
                          {slide.kind === "multi-select" && (
                            <p>
                              Submission credit:{" "}
                              <strong data-testid="multi-submission-credit">
                                {feedback.credit / 100}%
                              </strong>
                              .
                            </p>
                          )}
                          {!feedback.correct && (
                            <small>
                              One{" "}
                              {slide.lifePenalty ?? course.rules?.penalty ?? 25}
                              % life penalty per question per level attempt.
                            </small>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {slide.kind === "recovery" && (
                  <button
                    className="learner-primary"
                    disabled={
                      game.life === 0 ||
                      game.finished ||
                      game.recovered.includes(index)
                    }
                    onClick={() => setGame((g) => recoverLife(course, g))}
                  >
                    Restore {slide.lifeRecovery ?? course.rules?.recovery ?? 25}
                    % life
                  </button>
                )}
                {game.life === 0 && (
                  <div role="alert" className="feedback">
                    <p>
                      Life exhausted. Retry this level; previously earned level
                      stars are retained.
                    </p>
                    <button
                      className="learner-primary"
                      onClick={() => {
                        setGame((g) =>
                          visit(
                            course,
                            retryLevel(course, g),
                            retryLevel(course, g).index,
                          ),
                        );
                        setAnswer("");
                        setMultiDraft(null);
                        setFeedback(null);
                      }}
                    >
                      Retry current level
                    </button>
                  </div>
                )}
              </article>
              <div className="learner-pagination">
                <button
                  disabled={
                    index === 0 || !canNavigate(course, game, index - 1)
                  }
                  onClick={() => go(index - 1)}
                >
                  <ArrowLeft />
                  Previous
                </button>
                <span>
                  {Math.round(((index + 1) / slides.length) * 100)}% explored
                </span>
                <button
                  disabled={
                    index === slides.length - 1 ||
                    !canNavigate(course, game, index + 1)
                  }
                  onClick={() => go(index + 1)}
                >
                  Continue
                  <ArrowRight />
                </button>
              </div>
            </>
          ) : (
            <div className="lesson">
              <h1>No slides yet</h1>
              <p>Add a slide in the course editor to preview your course.</p>
            </div>
          )}
          <div className="finish-panel">
            <span>
              {game.stars.length} / {course.levels.length} level stars earned
            </span>
            <button
              className="learner-primary"
              disabled={
                game.finished ||
                !assessment(course, game).eligible ||
                !!(tracking && trackingError)
              }
              onClick={() => setGame((g) => finishGame(course, g))}
            >
              {game.finished ? "Learning complete" : "Finish learning"}
            </button>
            {!assessment(course, game).eligible && (
              <p>
                {course.levels.some((l) => l.slides.some((s) => s.composition))
                  ? "Complete required slides, mandatory activities and manual completion controls before finishing."
                  : "Visit all slides and pass every mandatory question before completing."}
              </p>
            )}
            {game.finished && (
              <p role="status">
                {reviewing
                  ? "Previously completed. Saved LMS result retained."
                  : tracking && trackingError
                    ? "Completion has not been saved to the LMS."
                    : tracking
                      ? completionSaved
                        ? "Completion submitted to the LMS."
                        : "Saving completion to the LMS…"
                      : "Preview complete. Progress is temporary."}
              </p>
            )}
          </div>
          <p className="demo-note">
            Demonstration content · Safety content and provisional brand colors
            require approval before use.
          </p>
        </section>
      </div>
    </div>
  );
}

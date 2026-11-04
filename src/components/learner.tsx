"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded data URLs render without image optimization */
import { useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Layers,
} from "lucide-react";
import { type CourseData, submitAnswer, type GameState } from "@/lib/course";
export function Learner({
  course,
  onClose,
}: {
  course: CourseData;
  onClose: () => void;
}) {
  const slides = course.levels.flatMap((l) =>
    l.slides.map((s) => ({ ...s, levelTitle: l.title })),
  );
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [feedback, setFeedback] = useState<boolean | null>(null),
    [game, setGame] = useState<GameState>({ life: 100, penalized: [] });
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
  function go(i: number) {
    setIndex(i);
    setAnswer("");
    setFeedback(null);
  }
  return (
    <div className="learner" style={style}>
      <div className="preview-bar">
        <span>
          LEARNER PREVIEW <span>· Temporary session</span>
        </span>
        <button onClick={onClose}>
          <ArrowLeft />
          Back to editor
        </button>
      </div>
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
          {course.levels.map((l) => (
            <div key={l.id}>
              <h3>{l.title}</h3>
              {l.slides.map((s) => {
                const i = slides.findIndex((x) => x.id === s.id);
                return (
                  <button
                    key={s.id}
                    className={i === index ? "selected" : ""}
                    onClick={() => go(i)}
                  >
                    <span>{i + 1}</span>
                    {s.title}
                  </button>
                );
              })}
            </div>
          ))}
          <button
            className="reset"
            onClick={() => {
              setGame({ life: 100, penalized: [] });
              go(0);
            }}
          >
            <RotateCcw />
            Restart preview
          </button>
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
                  {slide.kind === "single-choice"
                    ? "CHECK YOUR UNDERSTANDING"
                    : "EXPLORE & LEARN"}
                </span>
                <h1>{slide.title}</h1>
                <p>{slide.text}</p>
                {slide.image && (
                  <img
                    className="lesson-image"
                    src={slide.image}
                    alt={slide.title}
                  />
                )}{" "}
                {slide.kind === "single-choice" && (
                  <>
                    <fieldset className="answer-options">
                      <legend>Choose one answer</legend>
                      {slide.options.map((o, i) => (
                        <label
                          className={answer === o.id ? "chosen" : ""}
                          key={o.id}
                        >
                          <input
                            type="radio"
                            name="answer"
                            value={o.id}
                            checked={answer === o.id}
                            onChange={() => {
                              setAnswer(o.id);
                              setFeedback(null);
                            }}
                          />
                          <span>{String.fromCharCode(65 + i)}</span>
                          {o.text}
                        </label>
                      ))}
                    </fieldset>
                    <button
                      className="learner-primary"
                      disabled={!answer}
                      onClick={() => {
                        setGame((g) => submitAnswer(g, slide, answer));
                        setFeedback(answer === slide.correctId);
                      }}
                    >
                      Submit answer <ArrowRight />
                    </button>
                    {feedback !== null && (
                      <div role="status" className="feedback">
                        {feedback ? <CheckCircle2 /> : <XCircle />}
                        <div>
                          <strong>
                            {feedback
                              ? "Correct answer"
                              : "Let’s take another look"}
                          </strong>
                          <p>
                            {feedback
                              ? slide.correctFeedback
                              : slide.incorrectFeedback}
                          </p>
                          {!feedback && (
                            <small>
                              One 25% life penalty per question in this preview.
                            </small>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </article>
              <div className="learner-pagination">
                <button disabled={index === 0} onClick={() => go(index - 1)}>
                  <ArrowLeft />
                  Previous
                </button>
                <span>
                  {Math.round(((index + 1) / slides.length) * 100)}% explored
                </span>
                <button
                  disabled={index === slides.length - 1}
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
          <p className="demo-note">
            Demonstration content · Safety content and provisional brand colors
            require approval before use.
          </p>
        </section>
      </div>
    </div>
  );
}

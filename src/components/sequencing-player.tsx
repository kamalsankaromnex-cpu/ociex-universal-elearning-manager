"use client";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  RotateCcw,
  GripVertical,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { InteractionBlock } from "@/lib/composer/schema";
import type { Slide } from "@/lib/course";
import { questionSlide } from "@/lib/composer/model";
import { selectionIds } from "@/lib/interactions";
import type { LearnerGameState } from "@/lib/game";

export function SequencingPlayer({
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
  const q = questionSlide(slide, block);
  const answer = state.composer?.answers[block.id];
  const disabled = state.finished || state.life === 0;

  // Initialize draft order: from previous submission if any, otherwise unslotted
  const [placed, setPlaced] = useState<string[]>(() => {
    if (answer?.selection) {
      const restored = selectionIds(q, answer.selection);
      if (restored.length === q.options.length) return restored;
    }
    return [];
  });

  useEffect(() => {
    if (answer?.selection) {
      const restored = selectionIds(q, answer.selection);
      if (restored.length === q.options.length) setPlaced(restored);
    }
  }, [answer?.selection, answer?.last, q]);

  // Unplaced options
  const unplaced = q.options.filter((o) => !placed.includes(o.id));

  // Place option into next empty slot
  function placeOption(id: string) {
    if (disabled || placed.includes(id)) return;
    setPlaced([...placed, id]);
  }

  // Remove option from slot back to bank
  function removeOption(id: string) {
    if (disabled) return;
    setPlaced(placed.filter((x) => x !== id));
  }

  // Move item up / down in sequence
  function moveSlot(idx: number, delta: number) {
    if (disabled || idx + delta < 0 || idx + delta >= placed.length) return;
    const next = [...placed];
    const temp = next[idx];
    next[idx] = next[idx + delta];
    next[idx + delta] = temp;
    setPlaced(next);
  }

  const isComplete = placed.length === q.options.length;

  return (
    <section className="sequencing-container" aria-label={block.question.prompt}>
      {/* Question Prompt */}
      <div className="sequencing-header">
        <h3 className="sequencing-prompt">{block.question.prompt}</h3>
        <div className="game-instruction-pill">
          <span className="pill-icon">👆</span>
          <span>
            Click or arrange the stages in the correct order (from earliest to most advanced).
          </span>
        </div>
      </div>

      {/* Step Drop Slots (Staircase / Sequence Slots) */}
      <div className="sequence-slots-wrapper">
        <div className="sequence-slots-row">
          {q.options.map((_, slotIdx) => {
            const slottedId = placed[slotIdx];
            const opt = q.options.find((o) => o.id === slottedId);
            return (
              <div
                key={slotIdx}
                className={`sequence-step-card ${opt ? "filled" : "empty"}`}
                style={{ "--step-level": slotIdx } as React.CSSProperties}
              >
                <div className="sequence-step-badge">{slotIdx + 1}</div>
                {opt ? (
                  <div className="slotted-content">
                    <span className="slotted-title">{opt.text}</span>
                    {!disabled && (
                      <div className="slotted-actions">
                        <button
                          type="button"
                          className="slot-move-btn"
                          disabled={slotIdx === 0}
                          onClick={() => moveSlot(slotIdx, -1)}
                          title="Move earlier"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          className="slot-remove-btn"
                          onClick={() => removeOption(opt.id)}
                          title="Remove back to pool"
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          className="slot-move-btn"
                          disabled={slotIdx === placed.length - 1}
                          onClick={() => moveSlot(slotIdx, 1)}
                          title="Move later"
                        >
                          ▶
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="slot-placeholder">
                    <span>Drop here</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Yellow Upward Progress Arrow Banner */}
        <div className="sequence-progression-arrow" aria-hidden="true">
          <div className="arrow-line" />
          <div className="arrow-head" />
        </div>
      </div>

      {/* Options Bank (Unslotted Options) */}
      <div className="sequence-bank-wrapper">
        <div className="sequence-bank-header">
          <small>Available Stages to Position:</small>
        </div>
        <div className="sequence-bank-options">
          {unplaced.length === 0 ? (
            <p className="sequence-all-placed">All stages placed. Review order and submit.</p>
          ) : (
            unplaced.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="sequence-bank-card"
                disabled={disabled}
                onClick={() => placeOption(opt.id)}
              >
                <GripVertical className="bank-card-icon" />
                <span className="bank-card-text">{opt.text}</span>
                <span className="bank-card-action">+ Place</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="sequencing-actions">
        <button
          type="button"
          className="game-submit-btn"
          disabled={disabled || !isComplete}
          data-composer-submit={block.id}
          onClick={() => onSubmit(placed)}
        >
          <span>Submit</span>
          <ArrowRight className="submit-chevron" />
        </button>
        <button
          type="button"
          className="game-retry-btn"
          disabled={disabled || !answer}
          onClick={() => {
            setPlaced([]);
            onRetry();
          }}
        >
          <RotateCcw className="retry-icon" />
          <span>Reset Order</span>
        </button>
      </div>

      {/* Status & Feedback */}
      {answer && (
        <div
          className={`sequence-status-banner ${answer.passed ? "success" : "penalty"}`}
          role="status"
        >
          {answer.passed ? (
            <CheckCircle2 className="status-icon" />
          ) : (
            <AlertCircle className="status-icon" />
          )}
          <span>
            {answer.passed
              ? "All stages correctly sequenced! Challenge complete."
              : `Sequence not quite right. Best credit: ${answer.credit / 100}%.`}
          </span>
        </div>
      )}
    </section>
  );
}

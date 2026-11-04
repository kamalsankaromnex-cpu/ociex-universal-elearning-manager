"use client";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import type { Slide } from "@/lib/course";
import {
  IconButton,
  MediaPicker,
  SecondaryButton,
  SelectField,
  TextField,
} from "./ui";

/** Stable option IDs keep answer keys intact when labels or order change. */
export function QuestionOptionsEditor({
  slide,
  onChange,
  onError,
}: {
  slide: Slide;
  onChange: (patch: Partial<Slide>) => void;
  onError: (message: string) => void;
}) {
  const multi = slide.kind === "multi-select";
  const isSeq = slide.kind === "sequencing";

  function move(index: number, delta: number) {
    const options = [...slide.options];
    [options[index], options[index + delta]] = [
      options[index + delta],
      options[index],
    ];
    onChange({
      options,
      ...(isSeq ? { correctIds: options.map((o) => o.id) } : {}),
    });
  }

  return (
    <>
      {multi && (
        <>
          <SelectField
            label="Multi-select scoring"
            value={slide.scoringMode ?? "all-or-nothing"}
            onChange={(e) =>
              onChange({ scoringMode: e.target.value as Slide["scoringMode"] })
            }
          >
            <option value="all-or-nothing">All or nothing</option>
            <option value="partial-credit">Partial credit</option>
          </SelectField>
          <p className="hint">
            Exact selection earns full credit. Partial credit is max(0, (correct
            selections − incorrect selections) / correct answers). Mandatory
            questions require the exact answer set. Any non-exact submission
            costs at most one configured life penalty per level attempt.
          </p>
          {!slide.correctIds?.length && (
            <p role="alert" className="danger-text">
              Mark at least one correct answer before saving.
            </p>
          )}
        </>
      )}

      {isSeq && (
        <>
          <SelectField
            label="Sequencing scoring"
            value={slide.scoringMode ?? "all-or-nothing"}
            onChange={(e) =>
              onChange({ scoringMode: e.target.value as Slide["scoringMode"] })
            }
          >
            <option value="all-or-nothing">All or nothing</option>
            <option value="partial-credit">Partial credit</option>
          </SelectField>
          <p className="hint">
            The target sequence order is the order defined below (Step 1 to
            Step {slide.options.length}). Use Move Up / Move Down to set the
            correct sequence.
          </p>
        </>
      )}

      {slide.options.map((option, index) => {
        const letter = isSeq
          ? `Step ${index + 1}`
          : String.fromCharCode(65 + index);
        return (
          <fieldset className="answer-option-editor" key={option.id}>
            <legend>
              {isSeq ? `Target ${letter}` : `Answer option ${letter}`}
            </legend>
            <div className="option-edit">
              <TextField
                label={letter}
                value={option.text}
                onChange={(e) =>
                  onChange({
                    options: slide.options.map((o) =>
                      o.id === option.id ? { ...o, text: e.target.value } : o,
                    ),
                  })
                }
              />
              <div className="actions">
                <IconButton
                  label={`Move option ${letter} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </IconButton>
                <IconButton
                  label={`Move option ${letter} down`}
                  disabled={index === slide.options.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </IconButton>
                <IconButton
                  label={`Remove option ${letter}`}
                  disabled={
                    slide.options.length <= 2 ||
                    (!multi && !isSeq && slide.correctId === option.id) ||
                    (multi &&
                      slide.correctIds?.length === 1 &&
                      slide.correctIds.includes(option.id))
                  }
                  onClick={() => {
                    const options = slide.options.filter(
                      (o) => o.id !== option.id,
                    );
                    const correctIds = isSeq
                      ? options.map((o) => o.id)
                      : slide.correctIds?.filter((id) => id !== option.id);
                    onChange({
                      options,
                      ...(multi || isSeq
                        ? {
                            correctIds,
                            correctId: correctIds?.[0] ?? options[0].id,
                          }
                        : {}),
                    });
                  }}
                >
                  <Trash2 />
                </IconButton>
              </div>
            </div>
            {multi && (
              <>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={slide.correctIds?.includes(option.id) ?? false}
                    onChange={(e) =>
                      onChange({
                        correctIds: e.target.checked
                          ? [...(slide.correctIds ?? []), option.id]
                          : (slide.correctIds ?? []).filter(
                              (id) => id !== option.id,
                            ),
                      })
                    }
                  />
                  Option {letter} is correct
                </label>
                <MediaPicker
                  label={`Option ${letter} image`}
                  value={option.image ?? ""}
                  onChange={(image) =>
                    onChange({
                      options: slide.options.map((o) =>
                        o.id === option.id ? { ...o, image } : o,
                      ),
                    })
                  }
                  onError={onError}
                />
                {option.image && (
                  <TextField
                    label={`Option ${letter} image alternative text`}
                    maxLength={200}
                    value={option.imageAlt ?? ""}
                    onChange={(e) =>
                      onChange({
                        options: slide.options.map((o) =>
                          o.id === option.id
                            ? { ...o, imageAlt: e.target.value }
                            : o,
                        ),
                      })
                    }
                  />
                )}
              </>
            )}
          </fieldset>
        );
      })}
      <SecondaryButton
        disabled={slide.options.length >= 6}
        onClick={() => {
          const newOpt = {
            id: crypto.randomUUID(),
            text: isSeq
              ? `Stage ${slide.options.length + 1}`
              : "New option",
          };
          const nextOptions = [...slide.options, newOpt];
          onChange({
            options: nextOptions,
            ...(isSeq ? { correctIds: nextOptions.map((o) => o.id) } : {}),
          });
        }}
      >
        <Plus />
        {isSeq ? "Add sequence stage" : "Add answer option"}
      </SecondaryButton>
      {!multi && !isSeq && (
        <SelectField
          label="Demonstration correct answer"
          value={slide.correctId}
          onChange={(e) => onChange({ correctId: e.target.value })}
        >
          {slide.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.text}
            </option>
          ))}
        </SelectField>
      )}
    </>
  );
}

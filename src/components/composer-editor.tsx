"use client";
import { useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import type { Slide } from "@/lib/course";
import {
  compositionSchema,
  type Block,
  type Composition,
  type Rule,
} from "@/lib/composer/schema";
import { newBlock, questionSlide } from "@/lib/composer/model";
import { QuestionOptionsEditor } from "./question-options-editor";
import {
  SecondaryButton,
  IconButton,
  TextField,
  SelectField,
  MediaPicker,
  ErrorState,
} from "./ui";
export function ComposerEditor({
  slide,
  onChange,
  onError,
  navigationTargets,
}: {
  slide: Slide;
  onChange: (patch: Partial<Slide>) => void;
  onError: (message: string) => void;
  navigationTargets: { id: string; title: string }[];
}) {
  const c = slide.composition!;
  const [kind, setKind] = useState<Block["kind"]>("content");
  const validation = compositionSchema.safeParse(c);
  const save = (composition: Composition) => onChange({ composition });
  function patch(id: string, p: Partial<Block>) {
    save({
      ...c,
      blocks: c.blocks.map((b) =>
        b.id === id ? ({ ...b, ...p } as Block) : b,
      ),
    });
  }
  function remove(id: string) {
    if (!window.confirm("Remove this block and its linked feedback/rules?"))
      return;
    const ids = new Set([
      id,
      ...c.blocks
        .filter((b) => b.kind === "feedback" && b.interactionId === id)
        .map((b) => b.id),
    ]);
    save({
      ...c,
      blocks: c.blocks.filter((b) => !ids.has(b.id)),
      rules: c.rules
        .filter((r) => !r.trigger.sourceId || !ids.has(r.trigger.sourceId))
        .map((r) => ({
          ...r,
          actions: r.actions.filter(
            (a) => !("targetId" in a) || !ids.has(a.targetId),
          ),
        }))
        .filter((r) => r.actions.length),
      completion: {
        ...c.completion,
        interactionIds: c.completion.interactionIds.filter(
          (key) => !ids.has(key),
        ),
      },
    });
  }
  function move(index: number, delta: number) {
    const blocks = [...c.blocks];
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    save({ ...c, blocks });
  }
  function add() {
    let block = newBlock(kind, c.layout.regions[0]);
    if (block.kind === "feedback")
      block = {
        ...block,
        interactionId: c.blocks.find((b) => b.kind === "interaction")?.id ?? "",
      };
    save({ ...c, blocks: [...c.blocks, block] });
  }
  function manualControl() {
    const button = newBlock("button", c.layout.regions[0]);
    if (button.kind !== "button") return;
    save({
      ...c,
      blocks: [...c.blocks, { ...button, label: "Mark slide complete" }],
      rules: [
        ...c.rules,
        {
          id: crypto.randomUUID(),
          trigger: { event: "activate", sourceId: button.id },
          actions: [{ type: "complete" }],
        },
      ],
    });
  }
  const questions = c.blocks.filter((b) => b.kind === "interaction");
  return (
    <section aria-label="Universal Slide Composer">
      <h3>Universal Slide Composer</h3>
      <p>
        Blocks appear in collection order within their region. Feedback is
        attached to an interaction, not to a fixed slide position. Invalid rules
        cannot be saved or published.
      </p>
      {!validation.success && (
        <ErrorState
          message={validation.error.issues.map((i) => i.message).join(" · ")}
        />
      )}
      <div className="form-grid">
        <SelectField
          label="Slide layout"
          value={c.layout.variant}
          onChange={(e) => {
            const variant = e.target.value as Composition["layout"]["variant"];
            const regions =
              variant === "stacked" ? ["main"] : ["left", "right"];
            save({
              ...c,
              layout: { variant, regions },
              blocks: c.blocks.map((b) => ({
                ...b,
                region: regions.includes(b.region) ? b.region : regions[0],
              })),
            });
          }}
        >
          <option value="stacked">Stacked regions</option>
          <option value="columns">Two equal columns</option>
          <option value="left-wide">Wide left column</option>
          <option value="right-wide">Wide right column</option>
        </SelectField>
        <SelectField
          label="Slide completion"
          value={c.completion.mode}
          onChange={(e) =>
            save({
              ...c,
              completion: {
                ...c.completion,
                mode: e.target.value as Composition["completion"]["mode"],
              },
            })
          }
        >
          <option value="view">
            On view (mandatory activities still apply)
          </option>
          <option value="activities">Required activities</option>
          <option value="manual">Completion action</option>
        </SelectField>
        <SelectField
          label="Forward navigation"
          value={c.navigation}
          onChange={(e) =>
            save({
              ...c,
              navigation: e.target.value as Composition["navigation"],
            })
          }
        >
          <option value="free">Free navigation</option>
          <option value="after-completion">After slide completion</option>
        </SelectField>
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={c.completion.required}
          onChange={(e) =>
            save({
              ...c,
              completion: { ...c.completion, required: e.target.checked },
            })
          }
        />
        Required slide for course completion
      </label>
      {questions.map((q) => (
        <label className="check-field" key={q.id}>
          <input
            type="checkbox"
            checked={c.completion.interactionIds.includes(q.id)}
            onChange={(e) =>
              save({
                ...c,
                completion: {
                  ...c.completion,
                  interactionIds: e.target.checked
                    ? [...c.completion.interactionIds, q.id]
                    : c.completion.interactionIds.filter((id) => id !== q.id),
                },
              })
            }
          />
          Require activity: {q.question.prompt}
        </label>
      ))}
      {c.completion.mode === "manual" && (
        <SecondaryButton
          disabled={c.blocks.length >= 64 || c.rules.length >= 64}
          onClick={manualControl}
        >
          Add completion control
        </SecondaryButton>
      )}
      <div className="actions">
        <SelectField
          label="New block type"
          value={kind}
          onChange={(e) => setKind(e.target.value as Block["kind"])}
        >
          <option value="content">Content section</option>
          <option value="media">Image / media</option>
          <option value="interaction">Question interaction</option>
          <option value="feedback">Conditional feedback</option>
          <option value="button">Action button</option>
          <option value="recovery">Life recovery</option>
        </SelectField>
        <SecondaryButton disabled={c.blocks.length >= 64} onClick={add}>
          <Plus />
          Add block
        </SecondaryButton>
      </div>
      {c.blocks.map((block, index) => (
        <fieldset className="composer-editor-block" key={block.id}>
          <legend>
            Block {index + 1} · {block.kind}
          </legend>
          <div className="actions">
            <IconButton
              label={`Move block ${index + 1} up`}
              disabled={!index}
              onClick={() => move(index, -1)}
            >
              <ArrowUp />
            </IconButton>
            <IconButton
              label={`Move block ${index + 1} down`}
              disabled={index === c.blocks.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown />
            </IconButton>
            <IconButton
              label={`Remove block ${index + 1}`}
              disabled={c.blocks.length <= 1}
              onClick={() => remove(block.id)}
            >
              <Trash2 />
            </IconButton>
          </div>
          <small>
            Stable ID: <code>{block.id}</code> · schema v{block.version} ·{" "}
            {block.layer} layer
          </small>
          <SelectField
            label={`Block ${index + 1} region`}
            value={block.region}
            onChange={(e) => patch(block.id, { region: e.target.value })}
          >
            {c.layout.regions.map((region) => (
              <option key={region}>{region}</option>
            ))}
          </SelectField>
          {block.kind !== "feedback" && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={block.visible}
                onChange={(e) => patch(block.id, { visible: e.target.checked })}
              />
              Initially visible
            </label>
          )}
          {(block.kind === "content" || block.kind === "media") && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={block.required}
                onChange={(e) =>
                  patch(block.id, { required: e.target.checked })
                }
              />
              Must be revealed before completion
            </label>
          )}
          {(block.kind === "content" || block.kind === "feedback") && (
            <label className="field">
              <span>
                {block.kind === "content" ? "Content section" : "Feedback text"}
              </span>
              <textarea
                rows={4}
                value={block.text}
                onChange={(e) => patch(block.id, { text: e.target.value })}
              />
            </label>
          )}
          {block.kind === "media" && (
            <>
              <MediaPicker
                label="Block image"
                value={block.src}
                onChange={(src) => patch(block.id, { src })}
                onError={onError}
              />
              <TextField
                label="Block image alternative text"
                value={block.alt}
                onChange={(e) => patch(block.id, { alt: e.target.value })}
              />
            </>
          )}
          {block.kind === "interaction" && (
            <>
              <SelectField
                label="Activity type"
                value={block.question.kind}
                onChange={(e) => {
                  const kind = e.target.value as
                    "single-choice" | "multi-select";
                  patch(block.id, {
                    question: {
                      ...block.question,
                      kind,
                      correctId:
                        block.question.correctId ??
                        block.question.options[0].id,
                      correctIds: block.question.correctIds ?? [
                        block.question.correctId ??
                          block.question.options[0].id,
                      ],
                      scoringMode:
                        block.question.scoringMode ?? "all-or-nothing",
                    },
                  });
                }}
              >
                <option value="single-choice">Single choice</option>
                <option value="multi-select">Multi-select</option>
              </SelectField>
              <TextField
                label="Activity prompt"
                value={block.question.prompt}
                onChange={(e) =>
                  patch(block.id, {
                    question: { ...block.question, prompt: e.target.value },
                  })
                }
              />
              <QuestionOptionsEditor
                slide={questionSlide(slide, block)}
                onError={onError}
                onChange={(p) => {
                  const q = { ...questionSlide(slide, block), ...p };
                  patch(block.id, {
                    question: {
                      ...block.question,
                      kind: q.kind as "single-choice" | "multi-select",
                      options: q.options,
                      correctId: q.correctId,
                      correctIds: q.correctIds,
                      scoringMode: q.scoringMode,
                    },
                  });
                }}
              />
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={block.question.mandatory}
                  onChange={(e) =>
                    patch(block.id, {
                      question: {
                        ...block.question,
                        mandatory: e.target.checked,
                      },
                    })
                  }
                />
                Mandatory activity: exact answer required
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={block.question.scored}
                  onChange={(e) =>
                    patch(block.id, {
                      question: { ...block.question, scored: e.target.checked },
                    })
                  }
                />
                Include activity in score
              </label>
              <TextField
                label="Activity life penalty (%)"
                type="number"
                min={0}
                max={100}
                value={block.question.lifePenalty}
                onChange={(e) =>
                  patch(block.id, {
                    question: {
                      ...block.question,
                      lifePenalty: Number(e.target.value),
                    },
                  })
                }
              />
            </>
          )}
          {block.kind === "feedback" && (
            <div className="form-grid">
              <SelectField
                label="Feedback interaction"
                value={block.interactionId}
                onChange={(e) =>
                  patch(block.id, { interactionId: e.target.value })
                }
              >
                <option value="">Choose an interaction</option>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.question.prompt}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Feedback condition"
                value={block.condition}
                onChange={(e) =>
                  patch(block.id, {
                    condition: e.target.value as typeof block.condition,
                  })
                }
              >
                {["correct", "incorrect", "partial", "retry"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </SelectField>
              <SelectField
                label="Feedback presentation"
                value={block.presentation}
                onChange={(e) => {
                  const presentation = e.target
                    .value as typeof block.presentation;
                  patch(block.id, {
                    presentation,
                    layer: presentation === "inline" ? "base" : "overlay",
                  });
                }}
              >
                <option value="inline">Inline</option>
                <option value="popup">Popup</option>
                <option value="overlay">Overlay</option>
              </SelectField>
            </div>
          )}
          {block.kind === "button" && (
            <TextField
              label="Action button label"
              value={block.label}
              onChange={(e) => patch(block.id, { label: e.target.value })}
            />
          )}
          {block.kind === "recovery" && (
            <TextField
              label="Recovery amount (%)"
              type="number"
              min={0}
              max={100}
              value={block.amount}
              onChange={(e) =>
                patch(block.id, { amount: Number(e.target.value) })
              }
            />
          )}
        </fieldset>
      ))}
      <h3>Trigger / action rules</h3>
      <p>
        One bounded pass per explicit event. Actions never fire new events.
        Scores come only from normalized submissions; navigation targets must be
        later slides. Required work must be reachable through entry, buttons,
        correct answers or retries. Mistake-only branches can reveal optional
        hints.
      </p>
      {c.rules.map((rule, index) => (
        <RuleEditor
          key={rule.id}
          rule={rule}
          blocks={c.blocks}
          navigationTargets={navigationTargets}
          onChange={(next) =>
            save({
              ...c,
              rules: c.rules.map((r) => (r.id === rule.id ? next : r)),
            })
          }
          onRemove={() =>
            save({ ...c, rules: c.rules.filter((r) => r.id !== rule.id) })
          }
          index={index}
        />
      ))}
      <SecondaryButton
        disabled={c.rules.length >= 64}
        onClick={() => {
          const source = c.blocks.find((b) => b.kind === "button");
          save({
            ...c,
            rules: [
              ...c.rules,
              {
                id: crypto.randomUUID(),
                trigger: source
                  ? { event: "activate", sourceId: source.id }
                  : { event: "enter" },
                actions: [
                  {
                    type: "show",
                    targetId:
                      c.blocks.find((b) => b.kind !== "feedback")?.id ?? "",
                  },
                ],
              },
            ],
          });
        }}
      >
        <Plus />
        Add rule
      </SecondaryButton>
    </section>
  );
}
function RuleEditor({
  rule,
  blocks,
  navigationTargets,
  onChange,
  onRemove,
  index,
}: {
  rule: Rule;
  blocks: Block[];
  navigationTargets: { id: string; title: string }[];
  onChange: (rule: Rule) => void;
  onRemove: () => void;
  index: number;
}) {
  const sources = blocks.filter((b) =>
    rule.trigger.event === "activate"
      ? b.kind === "button"
      : b.kind === "interaction",
  );
  return (
    <fieldset className="composer-rule">
      <legend>Rule {index + 1}</legend>
      <SecondaryButton onClick={onRemove}>Remove rule</SecondaryButton>
      <SelectField
        label="Rule event"
        value={rule.trigger.event}
        onChange={(e) => {
          const event = e.target.value as Rule["trigger"]["event"];
          onChange({
            ...rule,
            trigger: {
              event,
              ...(event === "enter"
                ? {}
                : {
                    sourceId:
                      blocks.find((b) =>
                        event === "activate"
                          ? b.kind === "button"
                          : b.kind === "interaction",
                      )?.id ?? "",
                  }),
            },
          });
        }}
      >
        {["enter", "activate", "correct", "incorrect", "partial", "retry"].map(
          (event) => (
            <option key={event}>{event}</option>
          ),
        )}
      </SelectField>
      {rule.trigger.event !== "enter" && (
        <SelectField
          label="Rule source"
          value={rule.trigger.sourceId ?? ""}
          onChange={(e) =>
            onChange({
              ...rule,
              trigger: { ...rule.trigger, sourceId: e.target.value },
            })
          }
        >
          <option value="">Choose source</option>
          {sources.map((b) => (
            <option key={b.id} value={b.id}>
              {b.kind === "interaction"
                ? b.question.prompt
                : b.kind === "button"
                  ? b.label
                  : b.id}
            </option>
          ))}
        </SelectField>
      )}
      {rule.actions.map((action, i) => (
        <div className="composer-rule-action" key={i}>
          <SelectField
            label={`Action ${i + 1} type`}
            value={action.type}
            onChange={(e) => {
              const type = e.target.value;
              const next =
                type === "complete"
                  ? { type: "complete" as const }
                  : type === "navigate"
                    ? {
                        type: "navigate" as const,
                        slideId: navigationTargets[0]?.id ?? "",
                      }
                    : {
                        type: type as
                          "show" | "hide" | "feedback" | "record-result",
                        targetId:
                          type === "record-result"
                            ? (rule.trigger.sourceId ?? "")
                            : (blocks.find((b) =>
                                type === "feedback"
                                  ? b.kind === "feedback" &&
                                    b.interactionId === rule.trigger.sourceId &&
                                    b.condition === rule.trigger.event
                                  : b.kind !== "feedback",
                              )?.id ?? ""),
                      };
              onChange({
                ...rule,
                actions: rule.actions.map((a, n) => (n === i ? next : a)),
              });
            }}
          >
            {[
              "show",
              "hide",
              "feedback",
              "record-result",
              "complete",
              "navigate",
            ].map((type) => (
              <option
                key={type}
                disabled={type === "navigate" && !navigationTargets.length}
              >
                {type}
              </option>
            ))}
          </SelectField>
          {"targetId" in action && (
            <SelectField
              label={`Action ${i + 1} target`}
              value={action.targetId}
              onChange={(e) =>
                onChange({
                  ...rule,
                  actions: rule.actions.map((a, n) =>
                    n === i ? { ...action, targetId: e.target.value } : a,
                  ),
                })
              }
            >
              <option value="">Choose target</option>
              {blocks.map((b, n) => (
                <option key={b.id} value={b.id}>
                  Block {n + 1} · {b.kind}
                </option>
              ))}
            </SelectField>
          )}
          {action.type === "navigate" && (
            <SelectField
              label="Destination slide"
              value={action.slideId}
              onChange={(e) =>
                onChange({
                  ...rule,
                  actions: rule.actions.map((a, n) =>
                    n === i ? { ...action, slideId: e.target.value } : a,
                  ),
                })
              }
            >
              <option value="">Choose a later slide</option>
              {navigationTargets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </SelectField>
          )}
          <SecondaryButton
            disabled={rule.actions.length <= 1}
            onClick={() =>
              onChange({
                ...rule,
                actions: rule.actions.filter((_, n) => n !== i),
              })
            }
          >
            Remove action {i + 1}
          </SecondaryButton>
        </div>
      ))}
      <SecondaryButton
        disabled={rule.actions.length >= 16}
        onClick={() =>
          onChange({
            ...rule,
            actions: [
              ...rule.actions,
              {
                type: "show",
                targetId: blocks.find((b) => b.kind !== "feedback")?.id ?? "",
              },
            ],
          })
        }
      >
        Add action
      </SecondaryButton>
    </fieldset>
  );
}

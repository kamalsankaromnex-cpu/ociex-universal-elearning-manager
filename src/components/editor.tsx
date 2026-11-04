"use client";
import { useState, useEffect, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  Play,
  Layers,
  Palette,
  PanelTop,
  FileText,
  ListChecks,
  ChevronRight,
  Check,
  Copy,
  FileArchive,
} from "lucide-react";
import { ComposerEditor } from "./composer-editor";
import { convertSlide, duplicateSlide } from "@/lib/composer/model";
import { machineGuardingSlide } from "@/lib/machine-guarding-sample";
import { QuestionOptionsEditor } from "./question-options-editor";
import { isQuestion } from "@/lib/interactions";
import { PublishingManager } from "./publishing";
import {
  courseSchema,
  type CourseData,
  type Slide,
  newSlide,
  presets,
} from "@/lib/course";
import {
  Button,
  SecondaryButton,
  IconButton,
  PageHeader,
  TextField,
  SelectField,
  ColorField,
  Tabs,
  ConfirmDialog,
  MediaPicker,
  EmptyState,
  StatusBadge,
  ErrorState,
} from "./ui";
export function EditorToolbar({ children }: { children: ReactNode }) {
  return <div className="editor-toolbar">{children}</div>;
}
export function PropertyPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="property-panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export function SlideCard({
  slide,
  selected,
  onClick,
  number,
}: {
  slide: Slide;
  selected: boolean;
  onClick: () => void;
  number: number;
}) {
  return (
    <button
      className={`slide-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span className="slide-number">{String(number).padStart(2, "0")}</span>
      <span
        className="slide-mini"
        style={{ background: slide.background || undefined }}
      >
        {isQuestion(slide) ? <ListChecks /> : <FileText />}
      </span>
      <span>
        <strong>{slide.title}</strong>
        <small>
          {slide.kind === "multi-select"
            ? "Multi-select question"
            : slide.kind === "single-choice"
              ? "Single choice"
              : "Content slide"}
        </small>
      </span>
      <ChevronRight />
    </button>
  );
}
export function SlideList({
  slides,
  selected,
  onSelect,
}: {
  slides: Slide[];
  selected: string;
  onSelect: (s: string) => void;
}) {
  return (
    <div className="slide-list">
      {slides.map((s, i) => (
        <SlideCard
          key={s.id}
          slide={s}
          selected={selected === s.id}
          onClick={() => onSelect(s.id)}
          number={i + 1}
        />
      ))}
    </div>
  );
}
export function LevelCard({
  title,
  count,
  selected,
  onClick,
}: {
  title: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`level-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <Layers />
      <span>
        <strong>{title}</strong>
        <small>{count} slides</small>
      </span>
      <ChevronRight />
    </button>
  );
}
function move<T>(items: T[], index: number, delta: number) {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= items.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function CourseEditor({
  initial,
  onBack,
  onSave,
  onReload,
  onPreview,
  onError,
  onDirtyChange,
  courseId,
  revision,
}: {
  initial: CourseData;
  courseId: string;
  revision: number;
  onBack: () => void;
  onSave: (c: CourseData) => Promise<{
    ok: boolean;
    data?: CourseData;
    error?: string;
    conflict?: boolean;
  }>;
  onReload: () => Promise<void>;
  onPreview: (c: CourseData) => void;
  onError: (m: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [course, setCourse] = useState(initial),
    [tab, setTab] = useState("content"),
    [levelId, setLevelId] = useState(initial.levels[0]?.id || ""),
    [slideId, setSlideId] = useState(initial.levels[0]?.slides[0]?.id || ""),
    [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(initial)),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState<{
      message: string;
      conflict?: boolean;
    } | null>(null),
    [recovery, setRecovery] = useState<{
      data: CourseData;
      revision: number;
      valid?: boolean;
    } | null>(null),
    [draftLoaded, setDraftLoaded] = useState(false),
    [storageError, setStorageError] = useState(""),
    [confirm, setConfirm] = useState<{
      title: string;
      action: () => void;
    } | null>(null);
  const dirty = JSON.stringify(course) !== savedSnapshot;
  const draftKey = `course-draft:${courseId}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const stored = JSON.parse(raw);
        const parsed = courseSchema.safeParse(stored.data);
        if (
          stored.data &&
          Number.isInteger(stored.revision) &&
          JSON.stringify(stored.data) !== JSON.stringify(initial)
        )
          setRecovery({
            data: parsed.success ? parsed.data : stored.data,
            revision: stored.revision,
            valid: parsed.success,
          });
      }
    } catch {
      setStorageError(
        "Draft recovery is unavailable in this browser. Save before closing this tab.",
      );
    }
    setDraftLoaded(true);
    // Only inspect recovery when this course editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    if (!draftLoaded || recovery) return;
    try {
      if (dirty)
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({ data: course, revision }),
        );
      else sessionStorage.removeItem(draftKey);
    } catch {
      setStorageError(
        "Browser draft storage is full or unavailable. Save before closing this tab.",
      );
    }
  }, [course, dirty, revision, draftKey, draftLoaded, recovery]);
  function downloadDraft() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify(recovery ?? { data: course, revision }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "course-draft.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const li = course.levels.findIndex((l) => l.id === levelId),
    level = course.levels[li],
    si = level?.slides.findIndex((s) => s.id === slideId) ?? -1,
    slide = level?.slides[si];
  function change(fn: (c: CourseData) => CourseData) {
    setCourse(fn);
  }
  function patchSlide(p: Partial<Slide>) {
    change((c) => ({
      ...c,
      levels: c.levels.map((l) =>
        l.id === levelId
          ? {
              ...l,
              slides: l.slides.map((s) =>
                s.id === slideId ? { ...s, ...p } : s,
              ),
            }
          : l,
      ),
    }));
  }
  function changeSlideKind(kind: Slide["kind"]) {
    if (!slide) return;
    if (kind === "composed") {
      patchSlide(convertSlide(slide, course.rules));
      return;
    }
    if (slide.composition) {
      onError(
        "Composed slides use blocks. Duplicate/export the content before rebuilding a legacy slide.",
      );
      return;
    }
    const correctIds = (slide.correctIds ?? []).filter((id) =>
      slide.options.some((option) => option.id === id),
    );
    const correctId = slide.options.some(
      (option) => option.id === slide.correctId,
    )
      ? slide.correctId
      : (correctIds[0] ?? slide.options[0].id);
    patchSlide({
      kind,
      ...(kind === "multi-select"
        ? {
            correctIds: correctIds.length ? correctIds : [correctId],
            scoringMode: slide.scoringMode ?? "all-or-nothing",
          }
        : kind === "single-choice"
          ? { correctId }
          : {}),
    });
  }
  function theme(p: Partial<CourseData["theme"]>) {
    change((c) => ({ ...c, theme: { ...c.theme, ...p } }));
  }
  function selectLevel(id: string) {
    setLevelId(id);
    setSlideId(course.levels.find((l) => l.id === id)?.slides[0]?.id || "");
  }
  function addSlide() {
    appendSlide(newSlide());
  }
  function appendSlide(s: Slide) {
    change((c) => ({
      ...c,
      levels: c.levels.map((l) =>
        l.id === levelId ? { ...l, slides: [...l.slides, s] } : l,
      ),
    }));
    setSlideId(s.id);
  }
  function removeSlide() {
    change((c) => ({
      ...c,
      levels: c.levels.map((l) =>
        l.id === levelId
          ? { ...l, slides: l.slides.filter((s) => s.id !== slideId) }
          : l,
      ),
    }));
    setSlideId(level?.slides.find((s) => s.id !== slideId)?.id || "");
  }
  async function save() {
    if (saving || recovery) return;
    setSaving(true);
    setSaveError(null);
    try {
      const submitted = course;
      const result = await onSave(submitted);
      if (result.ok) {
        const normalized = result.data ?? submitted;
        setSavedSnapshot(JSON.stringify(normalized));
        setCourse((current) =>
          JSON.stringify(current) === JSON.stringify(submitted)
            ? normalized
            : current,
        );
      } else
        setSaveError({
          message: result.error ?? "Save failed",
          conflict: result.conflict,
        });
    } catch (e) {
      setSaveError({ message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="COURSE WORKSPACE"
        title={course.title}
        description="Shape your content. Make it your own."
        actions={
          <>
            <SecondaryButton
              onClick={() => {
                if (
                  dirty &&
                  !window.confirm("Leave without saving your changes?")
                )
                  return;
                onBack();
              }}
            >
              <ArrowLeft />
              All courses
            </SecondaryButton>
            <SecondaryButton
              disabled={!courseSchema.safeParse(course).success}
              onClick={() => onPreview(course)}
            >
              <Play />
              Preview
            </SecondaryButton>
            <Button disabled={saving || !!recovery} onClick={save}>
              <Save />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />
      {storageError && <ErrorState message={storageError} />}
      {recovery && (
        <section className="notice" aria-label="Recover unsaved draft">
          <h3>Unsaved draft found</h3>
          <p>
            {recovery.revision === revision
              ? "Restore the unsaved work from this browser tab, or discard it."
              : "The saved revision changed. Download your older draft before discarding it; it cannot overwrite the latest course."}
          </p>
          <p>
            {recovery.valid === false
              ? "This draft contains invalid or incomplete fields. Download the JSON to recover the text before discarding it."
              : ""}
          </p>
          <div className="actions">
            <SecondaryButton
              disabled={
                recovery.revision !== revision || recovery.valid === false
              }
              onClick={() => {
                setCourse(recovery.data);
                setRecovery(null);
              }}
            >
              Restore draft
            </SecondaryButton>
            <SecondaryButton onClick={downloadDraft}>
              Download draft JSON
            </SecondaryButton>
            <SecondaryButton
              onClick={() => {
                sessionStorage.removeItem(draftKey);
                setRecovery(null);
              }}
            >
              Discard recovered draft
            </SecondaryButton>
          </div>
        </section>
      )}
      {saveError && (
        <section aria-label="Save error">
          <ErrorState
            message={saveError.message}
            retry={saveError.conflict ? undefined : save}
          />
          {saveError.conflict && (
            <div className="actions">
              <SecondaryButton onClick={downloadDraft}>
                Download draft JSON
              </SecondaryButton>
              <SecondaryButton
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Reopen the latest saved revision? Download your draft first to keep local changes.",
                    )
                  )
                    return;
                  try {
                    await onReload();
                    sessionStorage.removeItem(draftKey);
                  } catch (e) {
                    setSaveError({
                      message: (e as Error).message,
                      conflict: true,
                    });
                  }
                }}
              >
                Reopen latest saved revision
              </SecondaryButton>
            </div>
          )}
        </section>
      )}
      <div className="editor-status">
        <StatusBadge>Draft</StatusBadge>
        <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <span>Content and theme are independent</span>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "content", label: "Content & slides", icon: <Layers /> },
          { value: "settings", label: "Course settings", icon: <FileText /> },
          { value: "theme", label: "Theme manager", icon: <Palette /> },
          { value: "header", label: "Course header", icon: <PanelTop /> },
          { value: "publish", label: "Publishing", icon: <FileArchive /> },
        ]}
      >
        {tab === "content" && (
          <div className="editor-grid">
            <section className="content-sidebar">
              <div className="panel-heading">
                <h3>Course structure</h3>
                <IconButton
                  label="Add level"
                  onClick={() => {
                    const l = {
                      id: crypto.randomUUID(),
                      title: `Level ${String(course.levels.length + 1).padStart(2, "0")} — Untitled`,
                      slides: [],
                    };
                    change((c) => ({ ...c, levels: [...c.levels, l] }));
                    setLevelId(l.id);
                    setSlideId("");
                  }}
                >
                  <Plus />
                </IconButton>
              </div>
              {course.levels.map((l) => (
                <LevelCard
                  key={l.id}
                  title={l.title}
                  count={l.slides.length}
                  selected={levelId === l.id}
                  onClick={() => selectLevel(l.id)}
                />
              ))}
              {level && (
                <>
                  <div className="panel-heading">
                    <h4>SLIDES</h4>
                    <IconButton label="Add slide" onClick={addSlide}>
                      <Plus />
                    </IconButton>
                  </div>
                  <SlideList
                    slides={level.slides}
                    selected={slideId}
                    onSelect={setSlideId}
                  />
                  <SecondaryButton
                    disabled={level.slides.length >= 100}
                    onClick={() => appendSlide(machineGuardingSlide())}
                  >
                    <Plus />
                    Add machine-guarding sample
                  </SecondaryButton>
                </>
              )}
            </section>
            <div className="editor-main">
              {level ? (
                <>
                  <section className="level-settings">
                    <TextField
                      label="Level title"
                      value={level.title}
                      onChange={(e) =>
                        change((c) => ({
                          ...c,
                          levels: c.levels.map((l) =>
                            l.id === levelId
                              ? { ...l, title: e.target.value }
                              : l,
                          ),
                        }))
                      }
                    />
                    <div className="actions">
                      <IconButton
                        label="Move level up"
                        disabled={li === 0}
                        onClick={() =>
                          change((c) => ({
                            ...c,
                            levels: move(c.levels, li, -1),
                          }))
                        }
                      >
                        <ArrowUp />
                      </IconButton>
                      <IconButton
                        label="Move level down"
                        disabled={li === course.levels.length - 1}
                        onClick={() =>
                          change((c) => ({
                            ...c,
                            levels: move(c.levels, li, 1),
                          }))
                        }
                      >
                        <ArrowDown />
                      </IconButton>
                      <IconButton
                        label="Delete level"
                        onClick={() =>
                          setConfirm({
                            title: "Delete level and its slides?",
                            action: () => {
                              change((c) => ({
                                ...c,
                                levels: c.levels.filter(
                                  (l) => l.id !== levelId,
                                ),
                              }));
                              setLevelId(
                                course.levels.find((l) => l.id !== levelId)
                                  ?.id || "",
                              );
                              setSlideId("");
                            },
                          })
                        }
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </section>
                  {slide ? (
                    <>
                      <EditorToolbar>
                        <span>
                          <FileText />
                          Slide editor
                        </span>
                        <div className="actions">
                          <IconButton
                            label="Move slide up"
                            disabled={si === 0}
                            onClick={() =>
                              change((c) => ({
                                ...c,
                                levels: c.levels.map((l) =>
                                  l.id === levelId
                                    ? { ...l, slides: move(l.slides, si, -1) }
                                    : l,
                                ),
                              }))
                            }
                          >
                            <ArrowUp />
                          </IconButton>
                          <IconButton
                            label="Move slide down"
                            disabled={si === level.slides.length - 1}
                            onClick={() =>
                              change((c) => ({
                                ...c,
                                levels: c.levels.map((l) =>
                                  l.id === levelId
                                    ? { ...l, slides: move(l.slides, si, 1) }
                                    : l,
                                ),
                              }))
                            }
                          >
                            <ArrowDown />
                          </IconButton>
                          <IconButton
                            label="Duplicate slide"
                            onClick={() => {
                              const copy = duplicateSlide(slide);
                              change((c) => ({
                                ...c,
                                levels: c.levels.map((l) =>
                                  l.id === levelId
                                    ? { ...l, slides: [...l.slides, copy] }
                                    : l,
                                ),
                              }));
                              setSlideId(copy.id);
                            }}
                          >
                            <Copy />
                          </IconButton>
                          <IconButton
                            label="Delete slide"
                            onClick={() =>
                              setConfirm({
                                title: "Delete this slide?",
                                action: removeSlide,
                              })
                            }
                          >
                            <Trash2 />
                          </IconButton>
                        </div>
                      </EditorToolbar>
                      <div className="slide-edit-surface">
                        <div className="form-grid">
                          <TextField
                            label="Slide title"
                            value={slide.title}
                            onChange={(e) =>
                              patchSlide({ title: e.target.value })
                            }
                          />
                          <SelectField
                            label="Slide type"
                            value={slide.kind}
                            disabled={!!slide.composition}
                            onChange={(e) =>
                              changeSlideKind(e.target.value as Slide["kind"])
                            }
                          >
                            <option value="content">Content slide</option>
                            <option value="single-choice">Single choice</option>
                            <option value="multi-select">
                              Multi-Select Question
                            </option>
                            <option value="recovery">Life recovery</option>
                            <option value="composed">
                              Universal Slide Composer
                            </option>
                          </SelectField>
                        </div>
                        {slide.composition ? (
                          <ComposerEditor
                            slide={slide}
                            onChange={patchSlide}
                            onError={onError}
                            course={course}
                            navigationTargets={course.levels
                              .flatMap((l) => l.slides)
                              .slice(
                                course.levels
                                  .flatMap((l) => l.slides)
                                  .findIndex((s) => s.id === slide.id) + 1,
                              )}
                          />
                        ) : (
                          <>
                            <label className="field">
                              <span>Learning content</span>
                              <textarea
                                rows={6}
                                value={slide.text}
                                onChange={(e) =>
                                  patchSlide({ text: e.target.value })
                                }
                              />
                            </label>
                            <div className="form-grid">
                              <MediaPicker
                                label="Slide image"
                                value={slide.image}
                                onChange={(image) => patchSlide({ image })}
                                onError={onError}
                              />
                              <div>
                                <ColorField
                                  label="Slide background override"
                                  value={slide.background || course.theme.card}
                                  onChange={(background) =>
                                    patchSlide({ background })
                                  }
                                />
                                <SecondaryButton
                                  onClick={() => patchSlide({ background: "" })}
                                >
                                  Use course theme
                                </SecondaryButton>
                                <p className="hint">
                                  {slide.background
                                    ? "This slide overrides the course card color."
                                    : "Inherits the course card color."}
                                </p>
                              </div>
                            </div>
                            {slide.kind === "recovery" && (
                              <TextField
                                label="Life restoration (%)"
                                type="number"
                                min={0}
                                max={100}
                                value={
                                  slide.lifeRecovery ??
                                  course.rules?.recovery ??
                                  25
                                }
                                onChange={(e) =>
                                  patchSlide({
                                    lifeRecovery: Number(e.target.value),
                                  })
                                }
                              />
                            )}
                            {isQuestion(slide) && (
                              <PropertyPanel
                                title={
                                  slide.kind === "multi-select"
                                    ? "Multi-select interaction"
                                    : "Single-choice interaction"
                                }
                              >
                                <label className="check-field">
                                  <input
                                    type="checkbox"
                                    checked={slide.mandatory !== false}
                                    onChange={(e) =>
                                      patchSlide({
                                        mandatory: e.target.checked,
                                      })
                                    }
                                  />
                                  Mandatory competency: correct answer required
                                  for completion
                                </label>
                                <label className="check-field">
                                  <input
                                    type="checkbox"
                                    checked={slide.scored !== false}
                                    onChange={(e) =>
                                      patchSlide({ scored: e.target.checked })
                                    }
                                  />
                                  Include this question in the score
                                </label>
                                <p className="hint">
                                  Mandatory controls completion. Scored controls
                                  the percentage. An unscored mandatory question
                                  still needs a correct answer.
                                </p>
                                <TextField
                                  label="Incorrect-answer life penalty (%)"
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={
                                    slide.lifePenalty ??
                                    course.rules?.penalty ??
                                    25
                                  }
                                  onChange={(e) =>
                                    patchSlide({
                                      lifePenalty: Number(e.target.value),
                                    })
                                  }
                                />
                                <p className="notice">
                                  Demonstration answer key. Verify with a
                                  qualified content owner before training use.
                                </p>
                                <QuestionOptionsEditor
                                  slide={slide}
                                  onChange={patchSlide}
                                  onError={onError}
                                />
                                {slide.kind === "multi-select" &&
                                  slide.scoringMode === "partial-credit" && (
                                    <TextField
                                      label="Partial-credit feedback"
                                      value={
                                        slide.partialFeedback ??
                                        "Some correct selections. Review your choices and try again."
                                      }
                                      onChange={(e) =>
                                        patchSlide({
                                          partialFeedback: e.target.value,
                                        })
                                      }
                                    />
                                  )}
                                <TextField
                                  label="Correct feedback"
                                  value={slide.correctFeedback}
                                  onChange={(e) =>
                                    patchSlide({
                                      correctFeedback: e.target.value,
                                    })
                                  }
                                />
                                <TextField
                                  label="Incorrect feedback"
                                  value={slide.incorrectFeedback}
                                  onChange={(e) =>
                                    patchSlide({
                                      incorrectFeedback: e.target.value,
                                    })
                                  }
                                />
                                <p className="hint">
                                  Life starts at 100%. The first incorrect
                                  submission per question deducts 25%.
                                </p>
                              </PropertyPanel>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title="Build your next moment"
                      description="Add a slide to this level to start creating."
                      action={
                        <Button onClick={addSlide}>
                          <Plus />
                          Add slide
                        </Button>
                      }
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  title="Start with a level"
                  description="Use the plus button in Course structure to add your first level."
                />
              )}
            </div>
          </div>
        )}
        {tab === "publish" && (
          <PublishingManager
            courseId={courseId}
            revision={revision}
            course={course}
            dirty={dirty || !!recovery}
          />
        )}
        {tab === "settings" && (
          <PropertyPanel title="Course details">
            <div className="notice">
              Completion requires visiting every slide, answering every
              mandatory competency correctly, and life above zero. Scores use
              the best correct answer within the attempt; correcting an answer
              earns credit. Life and scores are independent.
            </div>
            <SelectField
              label="Optional-question scoring"
              value={course.rules?.optionalScoring ?? "include"}
              onChange={(e) =>
                change((c) => ({
                  ...c,
                  rules: {
                    penalty: 25,
                    recovery: 25,
                    passScore: 80,
                    ...c.rules,
                    optionalScoring: e.target.value as "include" | "exclude",
                  },
                }))
              }
            >
              <option value="include">Include optional scored questions</option>
              <option value="exclude">
                Exclude optional questions from score
              </option>
            </SelectField>
            <SelectField
              label="Unanswered-question scoring"
              value={course.rules?.unansweredScoring ?? "zero"}
              onChange={(e) =>
                change((c) => ({
                  ...c,
                  rules: {
                    penalty: 25,
                    recovery: 25,
                    passScore: 80,
                    ...c.rules,
                    unansweredScoring: e.target.value as
                      "zero" | "exclude-optional",
                  },
                }))
              }
            >
              <option value="zero">
                Count unanswered scored questions as zero
              </option>
              <option value="exclude-optional">
                Exclude unanswered optional questions
              </option>
            </SelectField>
            <p className="hint">
              Unscored questions never enter the score denominator. With no
              scored questions, the score is 100%; mandatory completion checks
              still apply.
            </p>

            <TextField
              label="Course title"
              value={course.title}
              onChange={(e) => change((c) => ({ ...c, title: e.target.value }))}
            />
            <div className="form-grid">
              {(["penalty", "recovery", "passScore"] as const).map((key) => (
                <TextField
                  key={key}
                  label={
                    {
                      penalty: "Default penalty (%)",
                      recovery: "Default recovery (%)",
                      passScore: "Passing score (%)",
                    }[key]
                  }
                  type="number"
                  min={0}
                  max={100}
                  value={course.rules?.[key] ?? (key === "passScore" ? 80 : 25)}
                  onChange={(e) =>
                    change((c) => ({
                      ...c,
                      rules: {
                        penalty: 25,
                        recovery: 25,
                        passScore: 80,
                        ...c.rules,
                        [key]: Number(e.target.value),
                      },
                    }))
                  }
                />
              ))}
            </div>
            <label className="field">
              <span>Description</span>
              <textarea
                rows={4}
                value={course.description}
                onChange={(e) =>
                  change((c) => ({ ...c, description: e.target.value }))
                }
              />
            </label>
          </PropertyPanel>
        )}
        {tab === "header" && (
          <PropertyPanel title="Learner course header">
            <TextField
              label="Header title"
              value={course.header.title}
              onChange={(e) =>
                change((c) => ({
                  ...c,
                  header: { ...c.header, title: e.target.value },
                }))
              }
            />
            <TextField
              label="Header subtitle"
              value={course.header.subtitle}
              onChange={(e) =>
                change((c) => ({
                  ...c,
                  header: { ...c.header, subtitle: e.target.value },
                }))
              }
            />
            <label className="check-field">
              <input
                type="checkbox"
                checked={course.header.showLife}
                onChange={(e) =>
                  change((c) => ({
                    ...c,
                    header: { ...c.header, showLife: e.target.checked },
                  }))
                }
              />
              Show life meter
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={course.header.showLogo}
                onChange={(e) =>
                  change((c) => ({
                    ...c,
                    header: { ...c.header, showLogo: e.target.checked },
                  }))
                }
              />
              Show course logo
            </label>
            <MediaPicker
              label="Course logo"
              value={course.theme.logo}
              onChange={(logo) => theme({ logo })}
              onError={onError}
            />
          </PropertyPanel>
        )}
        {tab === "theme" && (
          <>
            <div className="notice">
              Course themes apply only to the learner experience. Preset colors
              are provisional pending corporate brand approval.
            </div>
            <div className="theme-editor">
              <PropertyPanel title="Course palette">
                <div className="preset-buttons">
                  {Object.entries(presets).map(([name, p]) => (
                    <SecondaryButton key={name} onClick={() => theme(p)}>
                      <Palette />
                      {name}
                    </SecondaryButton>
                  ))}
                </div>
                <div className="color-grid">
                  {(
                    [
                      "background",
                      "section",
                      "header",
                      "navigation",
                      "text",
                      "muted",
                      "primary",
                      "buttonText",
                      "border",
                      "card",
                      "icon",
                      "life",
                      "star",
                    ] as const
                  ).map((key) => (
                    <ColorField
                      key={key}
                      label={
                        key === "buttonText"
                          ? "Button text"
                          : key[0].toUpperCase() + key.slice(1)
                      }
                      value={course.theme[key]}
                      onChange={(v) => theme({ [key]: v })}
                    />
                  ))}
                </div>
              </PropertyPanel>
              <PropertyPanel title="Typography & media">
                <SelectField
                  label="Course font"
                  value={course.theme.font}
                  onChange={(e) =>
                    theme({
                      font: e.target.value as CourseData["theme"]["font"],
                    })
                  }
                >
                  <option>Inter</option>
                  <option>Georgia</option>
                  <option>Arial</option>
                </SelectField>
                <TextField
                  label="Body size (14–24px)"
                  type="number"
                  min={14}
                  max={24}
                  value={course.theme.fontSize}
                  onChange={(e) => theme({ fontSize: Number(e.target.value) })}
                />
                <TextField
                  label="Corner radius (0–32px)"
                  type="number"
                  min={0}
                  max={32}
                  value={course.theme.radius}
                  onChange={(e) => theme({ radius: Number(e.target.value) })}
                />
                <MediaPicker
                  label="Course background image"
                  value={course.theme.backgroundImage}
                  onChange={(backgroundImage) => theme({ backgroundImage })}
                  onError={onError}
                />
              </PropertyPanel>
            </div>
            <section
              className="theme-sample"
              style={{
                background: course.theme.background,
                color: course.theme.text,
                fontFamily: course.theme.font,
                borderColor: course.theme.border,
              }}
            >
              <div
                style={{
                  background: course.theme.header,
                  color: course.theme.buttonText,
                }}
              >
                {course.header.title}
              </div>
              <article
                style={{
                  background: course.theme.card,
                  borderRadius: course.theme.radius,
                }}
              >
                <Check style={{ color: course.theme.icon }} />
                <h2>Your next learning experience</h2>
                <p style={{ color: course.theme.muted }}>
                  A live look at your course’s visual identity.
                </p>
                <span
                  style={{
                    background: course.theme.primary,
                    color: course.theme.buttonText,
                  }}
                >
                  Continue learning
                </span>
              </article>
            </section>
          </>
        )}
      </Tabs>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
        title={confirm?.title || "Delete?"}
        onConfirm={() => confirm?.action()}
      />
    </>
  );
}

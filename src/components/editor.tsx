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
import { PublishingManager } from "./publishing";
import { type CourseData, type Slide, newSlide, presets } from "@/lib/course";
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
        {slide.kind === "single-choice" ? <ListChecks /> : <FileText />}
      </span>
      <span>
        <strong>{slide.title}</strong>
        <small>
          {slide.kind === "single-choice" ? "Single choice" : "Content slide"}
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
  onSave: (c: CourseData) => Promise<boolean>;
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
    [confirm, setConfirm] = useState<{
      title: string;
      action: () => void;
    } | null>(null);
  const dirty = JSON.stringify(course) !== savedSnapshot;
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
  function theme(p: Partial<CourseData["theme"]>) {
    change((c) => ({ ...c, theme: { ...c.theme, ...p } }));
  }
  function selectLevel(id: string) {
    setLevelId(id);
    setSlideId(course.levels.find((l) => l.id === id)?.slides[0]?.id || "");
  }
  function addSlide() {
    const s = newSlide();
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
    setSaving(true);
    try {
      const submitted = course;
      if (await onSave(submitted)) setSavedSnapshot(JSON.stringify(submitted));
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
            <SecondaryButton onClick={() => onPreview(course)}>
              <Play />
              Preview
            </SecondaryButton>
            <Button disabled={saving} onClick={save}>
              <Save />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />
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
                              const copy = {
                                ...slide,
                                id: crypto.randomUUID(),
                                title: `${slide.title} (copy)`,
                              };
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
                            onChange={(e) =>
                              patchSlide({
                                kind: e.target.value as Slide["kind"],
                              })
                            }
                          >
                            <option value="content">Content slide</option>
                            <option value="single-choice">Single choice</option>
                            <option value="recovery">Life recovery</option>
                          </SelectField>
                        </div>
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
                              slide.lifeRecovery ?? course.rules?.recovery ?? 25
                            }
                            onChange={(e) =>
                              patchSlide({
                                lifeRecovery: Number(e.target.value),
                              })
                            }
                          />
                        )}
                        {slide.kind === "single-choice" && (
                          <PropertyPanel title="Single-choice interaction">
                            <label className="check-field">
                              <input
                                type="checkbox"
                                checked={slide.mandatory !== false}
                                onChange={(e) =>
                                  patchSlide({ mandatory: e.target.checked })
                                }
                              />
                              Mandatory competency: correct answer required for
                              completion
                            </label>
                            <TextField
                              label="Incorrect-answer life penalty (%)"
                              type="number"
                              min={0}
                              max={100}
                              value={
                                slide.lifePenalty ?? course.rules?.penalty ?? 25
                              }
                              onChange={(e) =>
                                patchSlide({
                                  lifePenalty: Number(e.target.value),
                                })
                              }
                            />
                            <p className="notice">
                              Demonstration answer key. Verify with a qualified
                              content owner before training use.
                            </p>
                            {slide.options.map((o, i) => (
                              <div key={o.id} className="option-edit">
                                <TextField
                                  label={`Option ${String.fromCharCode(65 + i)}`}
                                  value={o.text}
                                  onChange={(e) =>
                                    patchSlide({
                                      options: slide.options.map((x) =>
                                        x.id === o.id
                                          ? { ...x, text: e.target.value }
                                          : x,
                                      ),
                                    })
                                  }
                                />
                                <IconButton
                                  label={`Remove option ${String.fromCharCode(65 + i)}`}
                                  disabled={
                                    slide.options.length <= 2 ||
                                    o.id === slide.correctId
                                  }
                                  onClick={() =>
                                    patchSlide({
                                      options: slide.options.filter(
                                        (x) => x.id !== o.id,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 />
                                </IconButton>
                              </div>
                            ))}
                            <SecondaryButton
                              disabled={slide.options.length >= 6}
                              onClick={() =>
                                patchSlide({
                                  options: [
                                    ...slide.options,
                                    {
                                      id: crypto.randomUUID(),
                                      text: "New option",
                                    },
                                  ],
                                })
                              }
                            >
                              <Plus />
                              Add answer option
                            </SecondaryButton>
                            <SelectField
                              label="Demonstration correct answer"
                              value={slide.correctId}
                              onChange={(e) =>
                                patchSlide({ correctId: e.target.value })
                              }
                            >
                              {slide.options.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.text}
                                </option>
                              ))}
                            </SelectField>
                            <TextField
                              label="Correct feedback"
                              value={slide.correctFeedback}
                              onChange={(e) =>
                                patchSlide({ correctFeedback: e.target.value })
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
            dirty={dirty}
          />
        )}
        {tab === "settings" && (
          <PropertyPanel title="Course details">
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

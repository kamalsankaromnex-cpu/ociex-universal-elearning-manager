"use client";

import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Monitor,
  Tablet,
  Smartphone,
  Play,
  LayoutGrid,
  Layers,
  MessageSquare,
  Film,
  Bookmark,
  Users,
  HardHat,
  Video,
  CheckSquare,
  CheckCircle2,
  ListOrdered,
  HeartPulse,
  AlertCircle,
  RotateCcw,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronRight,
  ShieldCheck,
  Smile,
  Bot,
  Image as ImageIcon,
} from "lucide-react";
import type { Slide, CourseData } from "@/lib/course";
import {
  compositionSchema,
  type Block,
  type Composition,
  type Rule,
} from "@/lib/composer/schema";
import { newBlock, questionSlide } from "@/lib/composer/model";
import { QuestionOptionsEditor } from "./question-options-editor";
import { ComposerSlide } from "./composer-slide";
import { initialGame, type LearnerGameState } from "@/lib/game";
import {
  SecondaryButton,
  IconButton,
  TextField,
  SelectField,
  ErrorState,
} from "./ui";

export function ComposerEditor({
  slide,
  onChange,
  onError,
  navigationTargets,
  course,
}: {
  slide: Slide;
  onChange: (patch: Partial<Slide>) => void;
  onError: (message: string) => void;
  navigationTargets: { id: string; title: string }[];
  course?: CourseData;
}) {
  const c = slide.composition!;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    c.blocks[0]?.id ?? null,
  );
  const [leftTab, setLeftTab] = useState<"palette" | "layers">("palette");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [viewMode, setViewMode] = useState<"canvas" | "preview">("canvas");
  const [previewState, setPreviewState] = useState<LearnerGameState>(
    initialGame(),
  );

  const validation = compositionSchema.safeParse(c);
  const save = (composition: Composition) => onChange({ composition });

  const selectedBlock = c.blocks.find((b) => b.id === selectedBlockId);

  function patchBlock(id: string, p: Partial<Block>) {
    save({
      ...c,
      blocks: c.blocks.map((b) =>
        b.id === id ? ({ ...b, ...p } as Block) : b,
      ),
    });
  }

  function removeBlock(id: string) {
    if (!window.confirm("Remove this block and any linked feedback/rules?"))
      return;
    const ids = new Set([
      id,
      ...c.blocks
        .filter((b) => b.kind === "feedback" && b.interactionId === id)
        .map((b) => b.id),
    ]);
    const nextBlocks = c.blocks.filter((b) => !ids.has(b.id));
    save({
      ...c,
      blocks: nextBlocks,
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
    if (selectedBlockId === id) {
      setSelectedBlockId(nextBlocks[0]?.id ?? null);
    }
  }

  function duplicateBlock(block: Block) {
    const cloneId = crypto.randomUUID();
    const cloned: Block = {
      ...JSON.parse(JSON.stringify(block)),
      id: cloneId,
    };
    const index = c.blocks.findIndex((b) => b.id === block.id);
    const nextBlocks = [...c.blocks];
    nextBlocks.splice(index + 1, 0, cloned);
    save({ ...c, blocks: nextBlocks });
    setSelectedBlockId(cloneId);
  }

  function moveBlock(index: number, delta: number) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= c.blocks.length) return;
    const blocks = [...c.blocks];
    [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
    save({ ...c, blocks });
  }

  function addBlock(
    kind: Block["kind"],
    extra: Partial<Block> = {},
    targetRegion?: string,
  ) {
    const region = targetRegion || c.layout.regions[0] || "main";
    let block = newBlock(kind, region);
    if (block.kind === "feedback") {
      const q = c.blocks.find((b) => b.kind === "interaction");
      block = {
        ...block,
        interactionId: q?.id ?? "",
      };
    }
    block = { ...block, ...extra } as Block;
    save({ ...c, blocks: [...c.blocks, block] });
    setSelectedBlockId(block.id);
    setLeftTab("layers");
  }

  // Fallback demo course container for preview simulation
  const dummyCourse: CourseData = course || {
    title: slide.title,
    description: "",
    theme: {
      background: "#081325",
      section: "#0E2445",
      header: "#0B1F3A",
      navigation: "#087E8B",
      text: "#F8FAFC",
      muted: "#94A3B8",
      primary: "#087E8B",
      buttonText: "#FFFFFF",
      border: "#1E3A8A",
      card: "#122B52",
      icon: "#087E8B",
      life: "#22C55E",
      star: "#F59E0B",
      font: "Inter",
      fontSize: 16,
      radius: 16,
      logo: "",
      backgroundImage: "",
      style: "game",
      gameAccent: "#F59E0B",
    },
    header: {
      title: "Universal Slide Studio",
      subtitle: slide.title,
      showLife: true,
      showLogo: true,
    },
    levels: [{ id: "preview-lvl", title: "Preview Level", slides: [slide] }],
  };

  const questions = c.blocks.filter(
    (b): b is Extract<Block, { kind: "interaction" }> =>
      b.kind === "interaction",
  );

  return (
    <section className="composer-studio" aria-label="Visual Slide Composer">
      {/* Top Header / Viewport & Mode Toolbar */}
      <div className="composer-studio-toolbar">
        <div className="composer-toolbar-left">
          <div className="composer-view-toggle">
            <button
              type="button"
              className={`composer-view-btn ${viewMode === "canvas" ? "active" : ""}`}
              onClick={() => setViewMode("canvas")}
            >
              <LayoutGrid size={15} />
              Visual Canvas
            </button>
            <button
              type="button"
              className={`composer-view-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
            >
              <Play size={15} />
              Live Preview
            </button>
          </div>

          <div className="composer-view-toggle">
            <button
              type="button"
              className={`composer-view-btn ${viewport === "desktop" ? "active" : ""}`}
              onClick={() => setViewport("desktop")}
              title="Desktop 100% viewport"
            >
              <Monitor size={15} />
              Desktop
            </button>
            <button
              type="button"
              className={`composer-view-btn ${viewport === "tablet" ? "active" : ""}`}
              onClick={() => setViewport("tablet")}
              title="Tablet 768px viewport"
            >
              <Tablet size={15} />
              Tablet
            </button>
            <button
              type="button"
              className={`composer-view-btn ${viewport === "mobile" ? "active" : ""}`}
              onClick={() => setViewport("mobile")}
              title="Mobile 390px viewport"
            >
              <Smartphone size={15} />
              Mobile
            </button>
          </div>
        </div>

        <div className="composer-toolbar-right">
          <span
            className={`composer-validation-pill ${validation.success ? "valid" : "invalid"}`}
          >
            <ShieldCheck size={14} />
            {validation.success
              ? `Valid (${c.blocks.length} blocks · ${c.rules.length} rules)`
              : `Validation Issue (${validation.error.issues.length})`}
          </span>

          <SelectField
            label="Scene backdrop"
            value={c.scene?.preset ?? "custom"}
            onChange={(e) => {
              const preset = e.target.value as NonNullable<
                Composition["scene"]
              >["preset"];
              save({
                ...c,
                scene: {
                  ...c.scene,
                  preset,
                  titleBanner: c.scene?.titleBanner ?? slide.title,
                },
              });
            }}
          >
            <option value="industrial-plant">Industrial Plant (Factory)</option>
            <option value="workshop">Workshop (Assembly Line)</option>
            <option value="clean-room">Clean Room</option>
            <option value="custom">Standard / Custom</option>
          </SelectField>

          <SelectField
            label="Layout"
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
            <option value="stacked">Stacked</option>
            <option value="columns">Two Columns (50/50)</option>
            <option value="left-wide">Left Wide (66/33)</option>
            <option value="right-wide">Right Wide (33/66)</option>
          </SelectField>
        </div>
      </div>

      {!validation.success && (
        <div style={{ padding: "8px 16px" }}>
          <ErrorState
            message={validation.error.issues.map((i) => i.message).join(" · ")}
          />
        </div>
      )}

      {/* Main Three-Panel Grid */}
      <div className="composer-studio-grid">
        {/* LEFT PANEL: Elements Palette & Layers Tree */}
        <div className="composer-panel-left">
          <div className="composer-panel-tabs">
            <button
              type="button"
              className={`composer-tab-btn ${leftTab === "palette" ? "active" : ""}`}
              onClick={() => setLeftTab("palette")}
            >
              <Plus size={14} />
              Elements
            </button>
            <button
              type="button"
              className={`composer-tab-btn ${leftTab === "layers" ? "active" : ""}`}
              onClick={() => setLeftTab("layers")}
            >
              <Layers size={14} />
              Layers ({c.blocks.length})
            </button>
          </div>

          {leftTab === "palette" ? (
            <div className="composer-palette-scroll">
              <div>
                <span className="composer-palette-section-title">
                  Content & Dialog
                </span>
                <div className="composer-palette-grid">
                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() => addBlock("content")}
                  >
                    <span className="composer-palette-icon">
                      <Bookmark size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Text Content</strong>
                      <span>Rich instructional explanation</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("content", {
                        contentVariant: "speech-bubble",
                        speaker: "Safety Team",
                        bubbleTail: "left",
                        text: "Enter character dialogue or challenge instructions.",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <MessageSquare size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Speech Bubble</strong>
                      <span>Character dialog with tail & badge</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("content", {
                        contentVariant: "scenario-panel",
                        title: "The Scenario",
                        text: "Describe the workplace context, safety incident, or operational challenge.",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <Film size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Scenario Panel</strong>
                      <span>Yellow ribbon clapperboard card</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("content", {
                        contentVariant: "heading-banner",
                        title: "Section Heading",
                        text: "Summary banner",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <Sparkles size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Heading Banner</strong>
                      <span>Angled yellow/blue title banner</span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <span className="composer-palette-section-title">
                  Cast & Artwork
                </span>
                <div className="composer-palette-grid">
                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("character", {
                        character: "character-group",
                        pose: "celebrating",
                        name: "DICV Safety Crew",
                        alt: "Safety Officer, Fox Mascot, and Drone",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <Users size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Character Trio</strong>
                      <span>Safety Lead, Fox Mascot & Drone</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("character", {
                        character: "safety-officer",
                        pose: "thinking",
                        name: "Safety Officer",
                        alt: "Safety officer in hard hat",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <HardHat size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Safety Officer</strong>
                      <span>Plant safety specialist in PPE</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("character", {
                        character: "fox-mascot",
                        pose: "standing",
                        name: "Fox Mascot",
                        alt: "Blue Fox safety mascot",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <Smile size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Fox Mascot</strong>
                      <span>Illustrated uniform mascot</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("character", {
                        character: "robot-drone",
                        pose: "standing",
                        name: "AI Drone",
                        alt: "Hovering safety drone",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <Bot size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Robot Drone</strong>
                      <span>Smart aerial sensor assistant</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() => addBlock("media")}
                  >
                    <span className="composer-palette-icon">
                      <ImageIcon size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Image / Photo</strong>
                      <span>Machine or safety graphic</span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <span className="composer-palette-section-title">
                  Media & Video
                </span>
                <div className="composer-palette-grid">
                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("video", {
                        src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                        startOverlay: true,
                        startButtonLabel: "Start Video",
                        allowSkip: true,
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <Video size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Video with Start Overlay</strong>
                      <span>Interactive briefing video player</span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <span className="composer-palette-section-title">
                  Interactions
                </span>
                <div className="composer-palette-grid">
                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("interaction", {
                        question: {
                          kind: "single-choice",
                          prompt: "Choose the correct safety procedure:",
                          options: [
                            { id: "opt1", text: "Report hazard immediately" },
                            { id: "opt2", text: "Proceed without PPE" },
                          ],
                          correctId: "opt1",
                          mandatory: true,
                          scored: true,
                          lifePenalty: 25,
                        },
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <CheckCircle2 size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Single Choice</strong>
                      <span>1-of-N question card</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("interaction", {
                        question: {
                          kind: "multi-select",
                          prompt: "Select all that apply:",
                          options: [
                            { id: "c1", text: "Injury to employees" },
                            { id: "c2", text: "Damage to equipment" },
                            { id: "c3", text: "Production disruption" },
                          ],
                          correctIds: ["c1", "c2", "c3"],
                          scoringMode: "all-or-nothing",
                          mandatory: true,
                          scored: true,
                          lifePenalty: 25,
                        },
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <CheckSquare size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Multi-Select</strong>
                      <span>Multiple consequence cards</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("interaction", {
                        question: {
                          kind: "sequencing",
                          prompt:
                            "Arrange the stages in the correct order (1 to 4):",
                          options: [
                            { id: "s1", text: "Reactive" },
                            { id: "s2", text: "Dependant" },
                            { id: "s3", text: "Independent" },
                            { id: "s4", text: "Interdependent" },
                          ],
                          correctIds: ["s1", "s2", "s3", "s4"],
                          scoringMode: "all-or-nothing",
                          mandatory: true,
                          scored: true,
                          lifePenalty: 25,
                        },
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <ListOrdered size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Sequencing Challenge</strong>
                      <span>Staircase drag & drop stages</span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <span className="composer-palette-section-title">
                  Actions & Gameplay
                </span>
                <div className="composer-palette-grid">
                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() =>
                      addBlock("button", {
                        label: "Continue Activity >",
                        buttonVariant: "game",
                      })
                    }
                  >
                    <span className="composer-palette-icon">
                      <ChevronRight size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Action Button</strong>
                      <span>Game-style navigation button</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() => addBlock("recovery", { amount: 25 })}
                  >
                    <span className="composer-palette-icon">
                      <HeartPulse size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Life Recovery</strong>
                      <span>Health station (+25% Life)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="composer-palette-item"
                    onClick={() => addBlock("feedback")}
                  >
                    <span className="composer-palette-icon">
                      <AlertCircle size={16} />
                    </span>
                    <div className="composer-palette-meta">
                      <strong>Conditional Feedback</strong>
                      <span>Popup or modal response</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="composer-layers-list">
              {c.blocks.map((b, i) => (
                <div
                  key={b.id}
                  className={`composer-layer-row ${b.id === selectedBlockId ? "selected" : ""}`}
                  onClick={() => setSelectedBlockId(b.id)}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      color: "#64748b",
                      marginRight: "4px",
                    }}
                  >
                    {b.kind === "content" ? (
                      <Bookmark size={14} />
                    ) : b.kind === "character" ? (
                      <Users size={14} />
                    ) : b.kind === "video" ? (
                      <Video size={14} />
                    ) : b.kind === "interaction" ? (
                      <CheckCircle2 size={14} />
                    ) : b.kind === "button" ? (
                      <ChevronRight size={14} />
                    ) : b.kind === "feedback" ? (
                      <AlertCircle size={14} />
                    ) : (
                      <HeartPulse size={14} />
                    )}
                  </span>
                  <span className="composer-layer-title">
                    {i + 1}. {b.kind}
                    {b.kind === "content"
                      ? ` (${b.contentVariant || "text"})`
                      : b.kind === "character"
                        ? ` (${b.character})`
                        : b.kind === "interaction"
                          ? ` (${b.question.kind})`
                          : ""}
                  </span>

                  <span
                    style={{
                      fontSize: "10px",
                      background: "#f1f5f9",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      color: "#475569",
                      marginRight: "4px",
                    }}
                  >
                    {b.region}
                  </span>

                  <div
                    className="composer-layer-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconButton
                      label="Move block up"
                      disabled={i === 0}
                      onClick={() => moveBlock(i, -1)}
                    >
                      <ArrowUp size={13} />
                    </IconButton>
                    <IconButton
                      label="Move block down"
                      disabled={i === c.blocks.length - 1}
                      onClick={() => moveBlock(i, 1)}
                    >
                      <ArrowDown size={13} />
                    </IconButton>
                    <IconButton
                      label={b.visible ? "Hide block" : "Show block"}
                      onClick={() => patchBlock(b.id, { visible: !b.visible })}
                    >
                      {b.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </IconButton>
                    <IconButton
                      label="Duplicate block"
                      onClick={() => duplicateBlock(b)}
                    >
                      <Copy size={13} />
                    </IconButton>
                    <IconButton
                      label="Remove block"
                      disabled={c.blocks.length <= 1}
                      onClick={() => removeBlock(b.id)}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER PANEL: Visual Slide Canvas / Interactive Preview */}
        <div className="composer-panel-center">
          <div className={`composer-canvas-viewport ${viewport}`}>
            <div className="composer-canvas-card">
              {/* Scene Backdrop Bar */}
              <div
                style={{
                  padding: "8px 16px",
                  background: "#081325",
                  borderBottom: "1px solid #1e3a8a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "#94a3b8",
                  fontSize: "12px",
                }}
              >
                <span>
                  <strong>Scene:</strong> {c.scene?.preset ?? "Standard"}{" "}
                  {c.scene?.titleBanner ? `— ${c.scene.titleBanner}` : ""}
                </span>
                <span>
                  {viewport.toUpperCase()} VIEW · {c.layout.variant}
                </span>
              </div>

              {viewMode === "preview" ? (
                <div style={{ padding: "16px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                      background: "rgba(255,255,255,0.05)",
                      padding: "8px 14px",
                      borderRadius: "8px",
                    }}
                  >
                    <span
                      style={{
                        color: "#38bdf8",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      Interactive Gameplay Simulation Mode
                    </span>
                    <SecondaryButton
                      onClick={() => setPreviewState(initialGame())}
                    >
                      <RotateCcw size={13} />
                      Reset simulation
                    </SecondaryButton>
                  </div>
                  <ComposerSlide
                    course={dummyCourse}
                    slide={slide}
                    state={previewState}
                    onChange={setPreviewState}
                  />
                </div>
              ) : (
                <div
                  className="composer-canvas-screen"
                  onClick={() => setSelectedBlockId(null)}
                >
                  <div
                    className={`composer-regions composer-${c.layout.variant}`}
                  >
                    {c.layout.regions.map((region) => (
                      <div key={region} className="composer-region">
                        {c.blocks
                          .filter((b) => b.region === region)
                          .map((b, blockIdx) => (
                            <div
                              key={b.id}
                              className={`composer-block-wrapper selectable ${
                                b.id === selectedBlockId ? "selected" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBlockId(b.id);
                              }}
                            >
                              {b.id === selectedBlockId && (
                                <>
                                  <div className="composer-block-selected-badge">
                                    <span>Selected: {b.kind}</span>
                                  </div>
                                  <div
                                    className="composer-block-quick-actions"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <IconButton
                                      label="Move Up"
                                      disabled={blockIdx === 0}
                                      onClick={() => {
                                        const globalIdx = c.blocks.findIndex(
                                          (x) => x.id === b.id,
                                        );
                                        moveBlock(globalIdx, -1);
                                      }}
                                    >
                                      <ArrowUp size={12} />
                                    </IconButton>
                                    <IconButton
                                      label="Move Down"
                                      disabled={
                                        blockIdx ===
                                        c.blocks.filter(
                                          (x) => x.region === region,
                                        ).length -
                                          1
                                      }
                                      onClick={() => {
                                        const globalIdx = c.blocks.findIndex(
                                          (x) => x.id === b.id,
                                        );
                                        moveBlock(globalIdx, 1);
                                      }}
                                    >
                                      <ArrowDown size={12} />
                                    </IconButton>
                                    <IconButton
                                      label="Duplicate"
                                      onClick={() => duplicateBlock(b)}
                                    >
                                      <Copy size={12} />
                                    </IconButton>
                                    <IconButton
                                      label="Delete"
                                      onClick={() => removeBlock(b.id)}
                                    >
                                      <Trash2 size={12} />
                                    </IconButton>
                                  </div>
                                </>
                              )}

                              {/* WYSIWYG Rendering of the block */}
                              {renderBlockVisualPreview(b)}
                            </div>
                          ))}

                        {/* Quick add slot in region */}
                        <button
                          type="button"
                          style={{
                            padding: "10px",
                            border: "1px dashed #334155",
                            borderRadius: "10px",
                            color: "#94a3b8",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            background: "rgba(255,255,255,0.02)",
                            cursor: "pointer",
                            width: "100%",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            addBlock("content", {}, region);
                          }}
                        >
                          <Plus size={14} />
                          Add element to {region} column
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Properties Inspector */}
        <div className="composer-panel-right">
          <div className="composer-inspector-header">
            <strong>
              {selectedBlock
                ? `Block: ${selectedBlock.kind}`
                : "Slide & Rules Properties"}
            </strong>
            {selectedBlock && (
              <SecondaryButton onClick={() => setSelectedBlockId(null)}>
                Slide Settings
              </SecondaryButton>
            )}
          </div>

          {selectedBlock ? (
            /* Block-Level Properties */
            <div className="composer-inspector-section">
              <span className="composer-inspector-title">
                General Placement
              </span>
              <SelectField
                label="Region column"
                value={selectedBlock.region}
                onChange={(e) =>
                  patchBlock(selectedBlock.id, { region: e.target.value })
                }
              >
                {c.layout.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Layer"
                value={selectedBlock.layer}
                onChange={(e) =>
                  patchBlock(selectedBlock.id, {
                    layer: e.target.value as "base" | "overlay",
                  })
                }
              >
                <option value="base">Base (Content flow)</option>
                <option value="overlay">Overlay (Floating dialog)</option>
              </SelectField>

              <label className="check-field">
                <input
                  type="checkbox"
                  checked={selectedBlock.visible}
                  onChange={(e) =>
                    patchBlock(selectedBlock.id, { visible: e.target.checked })
                  }
                />
                Initially visible
              </label>

              <label className="check-field">
                <input
                  type="checkbox"
                  checked={selectedBlock.required}
                  onChange={(e) =>
                    patchBlock(selectedBlock.id, { required: e.target.checked })
                  }
                />
                Must be revealed before completion
              </label>

              {/* Kind-Specific Fields */}
              {selectedBlock.kind === "content" && (
                <>
                  <span className="composer-inspector-title">
                    Content Configuration
                  </span>
                  <SelectField
                    label="Content presentation variant"
                    value={selectedBlock.contentVariant ?? "standard"}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        contentVariant: e.target.value as NonNullable<Extract<Block, { kind: "content" }>["contentVariant"]>,
                      })
                    }
                  >
                    <option value="standard">Standard text section</option>
                    <option value="speech-bubble">
                      Character Speech Bubble
                    </option>
                    <option value="scenario-panel">
                      Scenario Panel (Daimler)
                    </option>
                    <option value="heading-banner">Heading Banner</option>
                    <option value="notice">Notice Box</option>
                  </SelectField>

                  {selectedBlock.contentVariant === "speech-bubble" && (
                    <>
                      <TextField
                        label="Speaker badge name"
                        value={selectedBlock.speaker ?? ""}
                        placeholder="e.g. Safety Lead"
                        onChange={(e) =>
                          patchBlock(selectedBlock.id, {
                            speaker: e.target.value,
                          })
                        }
                      />
                      <SelectField
                        label="Bubble tail direction"
                        value={selectedBlock.bubbleTail ?? "left"}
                        onChange={(e) =>
                          patchBlock(selectedBlock.id, {
                            bubbleTail: e.target.value as NonNullable<Extract<Block, { kind: "content" }>["bubbleTail"]>,
                          })
                        }
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </SelectField>
                    </>
                  )}

                  {(selectedBlock.contentVariant === "scenario-panel" ||
                    selectedBlock.contentVariant === "heading-banner") && (
                    <TextField
                      label="Panel title"
                      value={selectedBlock.title ?? ""}
                      placeholder="e.g. The Scenario"
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, { title: e.target.value })
                      }
                    />
                  )}

                  <label className="field">
                    <span>Content text</span>
                    <textarea
                      rows={5}
                      value={selectedBlock.text}
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, { text: e.target.value })
                      }
                    />
                  </label>
                </>
              )}

              {selectedBlock.kind === "character" && (
                <>
                  <span className="composer-inspector-title">
                    Character Cast
                  </span>
                  <SelectField
                    label="Character role"
                    value={selectedBlock.character}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        character: e.target.value as Extract<Block, { kind: "character" }>["character"],
                      })
                    }
                  >
                    <option value="character-group">
                      Character Trio (Safety Lead + Fox + Drone)
                    </option>
                    <option value="safety-officer">Safety Officer</option>
                    <option value="fox-mascot">Fox Mascot</option>
                    <option value="robot-drone">Robot Drone</option>
                    <option value="custom">Custom Image</option>
                  </SelectField>

                  <SelectField
                    label="Pose"
                    value={selectedBlock.pose ?? "standing"}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        pose: e.target.value as NonNullable<Extract<Block, { kind: "character" }>["pose"]>,
                      })
                    }
                  >
                    <option value="standing">Standing</option>
                    <option value="thinking">Thinking</option>
                    <option value="pointing">Pointing</option>
                    <option value="celebrating">Celebrating</option>
                  </SelectField>

                  <TextField
                    label="Character name"
                    value={selectedBlock.name ?? ""}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, { name: e.target.value })
                    }
                  />
                  <TextField
                    label="Accessibility alt text"
                    value={selectedBlock.alt}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, { alt: e.target.value })
                    }
                  />
                </>
              )}

              {selectedBlock.kind === "video" && (
                <>
                  <span className="composer-inspector-title">
                    Video Settings
                  </span>
                  <TextField
                    label="Video URL / Source"
                    value={selectedBlock.src}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, { src: e.target.value })
                    }
                  />
                  <TextField
                    label="Video title"
                    value={selectedBlock.title ?? ""}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, { title: e.target.value })
                    }
                  />
                  <TextField
                    label="Start Button label"
                    value={selectedBlock.startButtonLabel ?? "Start Video"}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        startButtonLabel: e.target.value,
                      })
                    }
                  />
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={selectedBlock.startOverlay ?? true}
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, {
                          startOverlay: e.target.checked,
                        })
                      }
                    />
                    Enable Start Overlay over video
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={selectedBlock.allowSkip ?? true}
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, {
                          allowSkip: e.target.checked,
                        })
                      }
                    />
                    Allow skipping to end
                  </label>
                </>
              )}

              {selectedBlock.kind === "interaction" && (
                <>
                  <span className="composer-inspector-title">
                    Interaction Details
                  </span>
                  <SelectField
                    label="Activity type"
                    value={selectedBlock.question.kind}
                    onChange={(e) => {
                      const kind = e.target.value as
                        | "single-choice"
                        | "multi-select"
                        | "sequencing";
                      patchBlock(selectedBlock.id, {
                        question: {
                          ...selectedBlock.question,
                          kind,
                          correctId:
                            selectedBlock.question.correctId ??
                            selectedBlock.question.options[0].id,
                          correctIds:
                            selectedBlock.question.correctIds ??
                            (kind === "sequencing"
                              ? selectedBlock.question.options.map((o) => o.id)
                              : [selectedBlock.question.options[0].id]),
                          scoringMode:
                            selectedBlock.question.scoringMode ??
                            "all-or-nothing",
                        },
                      });
                    }}
                  >
                    <option value="single-choice">Single Choice</option>
                    <option value="multi-select">Multi-Select</option>
                    <option value="sequencing">
                      Sequencing Activity (Staircase)
                    </option>
                  </SelectField>

                  <TextField
                    label="Prompt / Question"
                    value={selectedBlock.question.prompt}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        question: {
                          ...selectedBlock.question,
                          prompt: e.target.value,
                        },
                      })
                    }
                  />

                  <QuestionOptionsEditor
                    slide={questionSlide(slide, selectedBlock)}
                    onError={onError}
                    onChange={(p) => {
                      const q = {
                        ...questionSlide(slide, selectedBlock),
                        ...p,
                      };
                      patchBlock(selectedBlock.id, {
                        question: {
                          ...selectedBlock.question,
                          kind: q.kind as "single-choice" | "multi-select" | "sequencing",
                          options: q.options,
                          correctId: q.correctId,
                          correctIds: q.correctIds,
                          scoringMode: q.scoringMode,
                        },
                      });
                    }}
                  />

                  <div className="form-grid">
                    <TextField
                      label="Life penalty (%)"
                      type="number"
                      min={0}
                      max={100}
                      value={selectedBlock.question.lifePenalty}
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, {
                          question: {
                            ...selectedBlock.question,
                            lifePenalty: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <SelectField
                      label="Scoring mode"
                      value={
                        selectedBlock.question.scoringMode ?? "all-or-nothing"
                      }
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, {
                          question: {
                            ...selectedBlock.question,
                            scoringMode: e.target.value as "all-or-nothing" | "partial-credit",
                          },
                        })
                      }
                    >
                      <option value="all-or-nothing">All or nothing</option>
                      <option value="partial-credit">Partial credit</option>
                    </SelectField>
                  </div>

                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={selectedBlock.question.mandatory}
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, {
                          question: {
                            ...selectedBlock.question,
                            mandatory: e.target.checked,
                          },
                        })
                      }
                    />
                    Mandatory: correct answer required to proceed
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={selectedBlock.question.scored}
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, {
                          question: {
                            ...selectedBlock.question,
                            scored: e.target.checked,
                          },
                        })
                      }
                    />
                    Include in overall score
                  </label>
                </>
              )}

              {selectedBlock.kind === "feedback" && (
                <>
                  <span className="composer-inspector-title">
                    Feedback Details
                  </span>
                  <SelectField
                    label="Feedback for question"
                    value={selectedBlock.interactionId}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        interactionId: e.target.value,
                      })
                    }
                  >
                    <option value="">Select question</option>
                    {questions.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.question.prompt}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Trigger Condition"
                    value={selectedBlock.condition}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        condition: e.target.value as Extract<Block, { kind: "feedback" }>["condition"],
                      })
                    }
                  >
                    <option value="correct">Correct</option>
                    <option value="incorrect">Incorrect</option>
                    <option value="partial">Partial</option>
                    <option value="retry">Retry</option>
                  </SelectField>

                  <SelectField
                    label="Presentation"
                    value={selectedBlock.presentation}
                    onChange={(e) => {
                      const presentation = e.target.value as Extract<Block, { kind: "feedback" }>["presentation"];
                      patchBlock(selectedBlock.id, {
                        presentation,
                        layer: presentation === "inline" ? "base" : "overlay",
                      });
                    }}
                  >
                    <option value="inline">Inline</option>
                    <option value="popup">Popup</option>
                    <option value="overlay">Overlay</option>
                  </SelectField>

                  <label className="field">
                    <span>Feedback message</span>
                    <textarea
                      rows={4}
                      value={selectedBlock.text}
                      onChange={(e) =>
                        patchBlock(selectedBlock.id, { text: e.target.value })
                      }
                    />
                  </label>
                </>
              )}

              {selectedBlock.kind === "button" && (
                <>
                  <span className="composer-inspector-title">
                    Button Styling
                  </span>
                  <TextField
                    label="Button label"
                    value={selectedBlock.label}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, { label: e.target.value })
                    }
                  />
                  <SelectField
                    label="Button variant"
                    value={selectedBlock.buttonVariant ?? "game"}
                    onChange={(e) =>
                      patchBlock(selectedBlock.id, {
                        buttonVariant: e.target.value as NonNullable<Extract<Block, { kind: "button" }>["buttonVariant"]>,
                      })
                    }
                  >
                    <option value="game">Game Pill (Daimler Style)</option>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="pill">Pill</option>
                  </SelectField>
                </>
              )}

              {selectedBlock.kind === "recovery" && (
                <TextField
                  label="Recovery amount (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={selectedBlock.amount}
                  onChange={(e) =>
                    patchBlock(selectedBlock.id, {
                      amount: Number(e.target.value),
                    })
                  }
                />
              )}

              {/* Component Styling */}
              <span className="composer-inspector-title">
                Custom Styling & Border
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <button
                  type="button"
                  className={`composer-view-btn ${selectedBlock.customStyle?.align === "left" ? "active" : ""}`}
                  onClick={() =>
                    patchBlock(selectedBlock.id, {
                      customStyle: {
                        ...selectedBlock.customStyle,
                        align: "left",
                      },
                    })
                  }
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  className={`composer-view-btn ${selectedBlock.customStyle?.align === "center" ? "active" : ""}`}
                  onClick={() =>
                    patchBlock(selectedBlock.id, {
                      customStyle: {
                        ...selectedBlock.customStyle,
                        align: "center",
                      },
                    })
                  }
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  className={`composer-view-btn ${selectedBlock.customStyle?.align === "right" ? "active" : ""}`}
                  onClick={() =>
                    patchBlock(selectedBlock.id, {
                      customStyle: {
                        ...selectedBlock.customStyle,
                        align: "right",
                      },
                    })
                  }
                >
                  <AlignRight size={14} />
                </button>
              </div>

              <SelectField
                label="Border style"
                value={selectedBlock.customStyle?.borderStyle ?? "none"}
                onChange={(e) =>
                  patchBlock(selectedBlock.id, {
                    customStyle: {
                      ...selectedBlock.customStyle,
                      borderStyle: e.target.value as NonNullable<NonNullable<Block["customStyle"]>["borderStyle"]>,
                    },
                  })
                }
              >
                <option value="none">None</option>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="game-card">Game Card</option>
              </SelectField>
            </div>
          ) : (
            /* Slide & Rules Properties */
            <div className="composer-inspector-section">
              <span className="composer-inspector-title">
                Slide Completion & Rules
              </span>
              <SelectField
                label="Completion mode"
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
                <option value="view">On view (Free progression)</option>
                <option value="activities">Require activities</option>
                <option value="manual">Manual completion action</option>
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
                <option value="after-completion">
                  Unlocked after slide completion
                </option>
              </SelectField>

              <label className="check-field">
                <input
                  type="checkbox"
                  checked={c.completion.required}
                  onChange={(e) =>
                    save({
                      ...c,
                      completion: {
                        ...c.completion,
                        required: e.target.checked,
                      },
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
                            : c.completion.interactionIds.filter(
                                (id) => id !== q.id,
                              ),
                        },
                      })
                    }
                  />
                  Require: {q.question.prompt.slice(0, 36)}…
                </label>
              ))}

              <span
                className="composer-inspector-title"
                style={{ marginTop: "16px" }}
              >
                Event & Action Rules ({c.rules.length})
              </span>
              {c.rules.map((rule, idx) => (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  blocks={c.blocks}
                  navigationTargets={navigationTargets}
                  index={idx}
                  onChange={(next) =>
                    save({
                      ...c,
                      rules: c.rules.map((r) => (r.id === rule.id ? next : r)),
                    })
                  }
                  onRemove={() =>
                    save({
                      ...c,
                      rules: c.rules.filter((r) => r.id !== rule.id),
                    })
                  }
                />
              ))}

              <SecondaryButton
                disabled={c.rules.length >= 64}
                onClick={() => {
                  const source = c.blocks.find(
                    (b) => b.kind === "button" || b.kind === "interaction",
                  );
                  save({
                    ...c,
                    rules: [
                      ...c.rules,
                      {
                        id: crypto.randomUUID(),
                        trigger: source
                          ? {
                              event:
                                source.kind === "button"
                                  ? "activate"
                                  : "correct",
                              sourceId: source.id,
                            }
                          : { event: "enter" },
                        actions: [{ type: "complete" }],
                      },
                    ],
                  });
                }}
              >
                <Plus size={14} />
                Add Rule
              </SecondaryButton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function renderBlockVisualPreview(b: Block) {
  switch (b.kind) {
    case "character":
      return (
        <div
          style={{
            textAlign: "center",
            padding: "12px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "12px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#f8fafc",
              marginBottom: "6px",
            }}
          >
            {b.name || "Character Crew"} ({b.pose || "standing"})
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              fontStyle: "italic",
            }}
          >
            {b.alt}
          </div>
        </div>
      );
    case "content":
      if (b.contentVariant === "speech-bubble") {
        return (
          <div className="game-speech-bubble tail-left">
            {b.speaker && (
              <span className="speech-speaker-badge">{b.speaker}</span>
            )}
            <p>{b.text}</p>
            <span className="speech-bubble-tail" />
          </div>
        );
      }
      if (b.contentVariant === "scenario-panel") {
        return (
          <div className="game-scenario-card">
            <div className="scenario-ribbon-tag">
              <Film size={15} />
              <span>{b.title || "The Scenario"}</span>
            </div>
            <p>{b.text}</p>
          </div>
        );
      }
      return (
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            padding: "16px",
            borderRadius: "12px",
            color: "#f8fafc",
          }}
        >
          {b.title && (
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "16px",
                color: "#38bdf8",
              }}
            >
              {b.title}
            </h4>
          )}
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>
            {b.text}
          </p>
        </div>
      );
    case "video":
      return (
        <div
          style={{
            position: "relative",
            background: "#020617",
            borderRadius: "16px",
            overflow: "hidden",
            border: "2px solid #1e293b",
            minHeight: "180px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                background: "#facc15",
                color: "#0f172a",
                fontWeight: 800,
                padding: "8px 18px",
                borderRadius: "9999px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Play size={16} fill="#0f172a" />
              {b.startButtonLabel || "Start Video"}
            </span>
            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
              {b.title || "Safety Video Briefing"}
            </span>
          </div>
        </div>
      );
    case "interaction":
      return (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "18px",
            color: "#0f172a",
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#0284c7",
              marginBottom: "4px",
            }}
          >
            {b.question.kind.toUpperCase()} ACTIVITY
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "14px",
            }}
          >
            {b.question.prompt}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {b.question.options.map((opt, i) => (
              <div
                key={opt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius:
                      b.question.kind === "single-choice" ? "50%" : "6px",
                    border: "2px solid #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  {opt.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    case "button":
      return (
        <div style={{ textAlign: "right", marginTop: "12px" }}>
          <span
            className="game-submit-btn"
            style={{ display: "inline-flex", cursor: "pointer" }}
          >
            {b.label}
          </span>
        </div>
      );
    case "recovery":
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 18px",
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid #22c55e",
            borderRadius: "12px",
            color: "#86efac",
          }}
        >
          <HeartPulse size={20} color="#22c55e" />
          <span>Health Recharge Station (+{b.amount}% Life)</span>
        </div>
      );
    case "feedback":
      return (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px dashed #60a5fa",
            borderRadius: "10px",
            color: "#93c5fd",
            fontSize: "13px",
          }}
        >
          <strong>Feedback ({b.condition}):</strong> {b.text}
        </div>
      );
    default:
      return null;
  }
}

function RuleItem({
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
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "10px",
        marginBottom: "8px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Rule {index + 1}: On {rule.trigger.event}
        </span>
        <IconButton label="Delete rule" onClick={onRemove}>
          <Trash2 size={12} />
        </IconButton>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <SelectField
          label="Trigger event"
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
                            : event === "video-complete"
                              ? b.kind === "video"
                              : b.kind === "interaction",
                        )?.id ?? "",
                    }),
              },
            });
          }}
        >
          {[
            "enter",
            "activate",
            "correct",
            "incorrect",
            "partial",
            "retry",
            "video-complete",
          ].map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </SelectField>

        {rule.trigger.event !== "enter" && (
          <SelectField
            label="Source element"
            value={rule.trigger.sourceId ?? ""}
            onChange={(e) =>
              onChange({
                ...rule,
                trigger: { ...rule.trigger, sourceId: e.target.value },
              })
            }
          >
            <option value="">Choose source</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.kind === "interaction"
                  ? `[Activity] ${b.question.prompt.slice(0, 24)}…`
                  : b.kind === "button"
                    ? `[Button] ${b.label}`
                    : b.kind === "video"
                      ? `[Video] ${b.title || b.id}`
                      : b.id}
              </option>
            ))}
          </SelectField>
        )}

        {rule.actions.map((act, actIdx) => (
          <div
            key={actIdx}
            style={{
              padding: "6px",
              background: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #f1f5f9",
            }}
          >
            <SelectField
              label={`Action ${actIdx + 1}`}
              value={act.type}
              onChange={(e) => {
                const type = e.target.value as Rule["actions"][number]["type"];
                const nextAct =
                  type === "complete"
                    ? { type: "complete" as const }
                    : type === "navigate"
                      ? {
                          type: "navigate" as const,
                          slideId: navigationTargets[0]?.id ?? "",
                        }
                      : {
                          type,
                          targetId: blocks[0]?.id ?? "",
                        };
                onChange({
                  ...rule,
                  actions: rule.actions.map((a, i) =>
                    i === actIdx ? nextAct : a,
                  ),
                });
              }}
            >
              <option value="complete">Mark complete</option>
              <option value="show">Show element</option>
              <option value="hide">Hide element</option>
              <option value="feedback">Show feedback</option>
              <option value="record-result">Record result</option>
              <option value="navigate">Navigate</option>
            </SelectField>

            {"targetId" in act && (
              <SelectField
                label="Target element"
                value={act.targetId}
                onChange={(e) =>
                  onChange({
                    ...rule,
                    actions: rule.actions.map((a, i) =>
                      i === actIdx ? { ...a, targetId: e.target.value } : a,
                    ),
                  })
                }
              >
                {blocks.map((b, n) => (
                  <option key={b.id} value={b.id}>
                    {n + 1}. {b.kind}
                  </option>
                ))}
              </SelectField>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

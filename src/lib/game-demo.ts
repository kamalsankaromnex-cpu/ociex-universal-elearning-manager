import { newCourse, newSlide, type CourseData, type Slide } from "./course";
import { newBlock } from "./composer/model";
import type { Block, Composition, InteractionBlock } from "./composer/schema";

export function createComposedSlide(
  title: string,
  id: string,
  blocks: Block[],
  patch: Partial<Composition> = {},
): Slide {
  return {
    ...newSlide(title),
    id,
    kind: "composed",
    text: "",
    image: "",
    composition: {
      version: 1,
      layout: { variant: "stacked", regions: ["main"] },
      blocks,
      rules: [],
      completion: { mode: "activities", required: true, interactionIds: [] },
      navigation: "free",
      ...patch,
    },
  };
}

export function createQuestionBlock(
  id: string,
  prompt: string,
  kind: "single-choice" | "multi-select" | "sequencing",
  options: { id: string; text: string; icon?: string }[],
  correct: string | string[],
  region = "main",
  scoringMode: "all-or-nothing" | "partial-credit" = "all-or-nothing",
  lifePenalty = 20,
): InteractionBlock {
  const block = newBlock("interaction", region);
  if (block.kind !== "interaction") throw Error("Invalid interaction block");
  return {
    ...block,
    id,
    question: {
      kind,
      prompt,
      options,
      correctId: typeof correct === "string" ? correct : correct[0],
      correctIds: Array.isArray(correct) ? correct : [correct],
      scoringMode,
      mandatory: true,
      scored: true,
      lifePenalty,
    },
  };
}

export function createFeedbackBlock(
  id: string,
  interactionId: string,
  condition: "correct" | "incorrect" | "partial" | "retry",
  text: string,
  presentation: "inline" | "popup" | "overlay" = "popup",
  region = "main",
): Block {
  return {
    ...newBlock("feedback", region),
    kind: "feedback",
    id,
    visible: false,
    interactionId,
    condition,
    text,
    presentation,
    layer: presentation === "inline" ? "base" : "overlay",
  };
}

/**
 * Daimler EHS Game Experience — Demonstrates:
 * Demo 1: Content-Only Illustrated Scene (Vision Zero welcome, character trio, no compulsory questions)
 * Demo 2: Safety Review Game (machine guard scenario, multi-select consequences, committee single-choice, functioning life meter)
 * Demo 3: Video Start Overlay & Sequencing Challenge (video with start button, followed by 4-stage safety culture ordering)
 * Slide 4: Side-by-side two-column layout with multiple independent interactions & separate feedback
 * Slide 5: Safety recovery station with health restore (+25% Life)
 */
export function daimlerEhsDemoCourse(): CourseData {
  const c = newCourse("DICV EHS Refresher Training — Safety eModule");
  c.description =
    "Illustrated 2D game-based safety learning experience featuring DICV Safety Culture, Vision Zero, Machine Guarding, and Committee Governance.";
  c.header = {
    title: "DICV EHS Refresher Training — Safety eModule",
    subtitle: "Block 1: DICV Safety Culture & Vision Zero",
    showLife: true,
    showLogo: true,
  };
  c.rules = {
    penalty: 20,
    recovery: 25,
    passScore: 75,
    optionalScoring: "include",
    unansweredScoring: "zero",
  };
  c.theme = {
    ...c.theme,
    header: "#0B1F3A",
    primary: "#087E8B",
    navigation: "#087E8B",
    icon: "#087E8B",
    background: "#081325",
    section: "#0E2445",
    card: "#122B52",
    text: "#F8FAFC",
    border: "#1E3A8A",
    buttonText: "#FFFFFF",
    life: "#22C55E",
    star: "#F59E0B",
    style: "game",
    gameAccent: "#F59E0B",
  };

  // Demo 1: Content-Only Illustrated Scene (Screenshot 3 inspired)
  const demo1Content = createComposedSlide(
    "Welcome to Block 1: DICV Safety Culture & Vision Zero",
    "daimler:demo1:welcome",
    [
      {
        ...newBlock("character", "main"),
        kind: "character",
        id: "d1:characters",
        character: "character-group",
        pose: "celebrating",
        name: "DICV Safety Crew",
        alt: "Safety Officer, Fox Mascot, and Robot Drone welcoming the learner",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d1:speech",
        contentVariant: "speech-bubble",
        speaker: "DICV Safety Team",
        bubbleTail: "left",
        text: "Welcome to Block 1: DICV Safety Culture & Vision Zero! Explore the topics in this block to strengthen your understanding of proactive safety protocols and our journey toward zero harm.",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d1:menu",
        contentVariant: "scenario-panel",
        title: "Block 1 Menu — Key Safety Milestones",
        text: "1. Why Safety Is Important — Machine Guarding & Consequence Awareness\n2. DICV EHS Vision — Proactive Risk Management\n3. Safety Strategy — Safe Workplace, Systems & Behavior\n4. Safety Culture — 4-Stage Evolution\n5. Safety Review Structure — Apex, Sub, and Ad-Hoc Committees\n6. Vision Zero — Zero Fatalities, Zero Injuries, Zero Regrets",
      },
      {
        ...newBlock("button", "main"),
        kind: "button",
        id: "d1:btn-start",
        label: "Begin Challenge >",
        buttonVariant: "game",
      },
    ],
    {
      scene: {
        preset: "industrial-plant",
        titleBanner: "Welcome to Block 1: DICV Safety Culture & Vision Zero",
      },
      completion: { mode: "view", required: false, interactionIds: [] },
      navigation: "free",
      rules: [
        {
          id: "r-d1-start",
          trigger: { event: "activate", sourceId: "d1:btn-start" },
          actions: [{ type: "complete" }],
        },
      ],
    },
  );

  // Demo 2: Safety Review Game — Machine Guarding Multi-Select (Screenshot 1 inspired)
  const d2Question = createQuestionBlock(
    "d2:q-consequences",
    "If a colleague bypassed a machine guard to save time, what could happen next?",
    "multi-select",
    [
      { id: "inj", text: "Injury to employees" },
      { id: "eqp", text: "Damage to equipment" },
      { id: "prd", text: "Production disruption" },
      { id: "env", text: "Environmental impact" },
      { id: "fin", text: "Financial and reputational loss" },
    ],
    ["inj", "eqp", "prd", "env", "fin"],
    "main",
    "all-or-nothing",
    20,
  );
  const d2FeedbackCorrect = createFeedbackBlock(
    "d2:fb-correct",
    d2Question.id,
    "correct",
    "Outstanding! All 5 consequences can result from bypassing a safety barrier. Safety guards exist to protect lives, machinery, continuity, and our shared environment.",
    "popup",
  );
  const d2FeedbackIncorrect = createFeedbackBlock(
    "d2:fb-incorrect",
    d2Question.id,
    "incorrect",
    "Bypassing a machine guard jeopardizes every operational dimension: employee health, machinery integrity, production line uptime, environmental controls, and organizational trust. Review the scenario and select all applicable risks.",
    "popup",
  );

  const demo2MultiSelect = createComposedSlide(
    "Why Safety is Important",
    "daimler:demo2:machine-guard",
    [
      {
        ...newBlock("character", "main"),
        kind: "character",
        id: "d2:characters",
        character: "character-group",
        pose: "thinking",
        name: "Safety Officer & Fox Mascot",
        alt: "Safety Officer thinking beside Fox mascot and Drone",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d2:speech",
        contentVariant: "speech-bubble",
        speaker: "Safety Lead",
        bubbleTail: "left",
        text: "A colleague bypassed a machine guard to save time. If we ignore such a safety precaution, what could happen next?",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d2:scenario",
        contentVariant: "scenario-panel",
        title: "The Scenario",
        text: "Safety interlock switches and physical protective barriers prevent accidental access to moving pinch-points. Bypassing interlocks for short-term convenience introduces catastrophic failure modes.",
      },
      d2Question,
      d2FeedbackCorrect,
      d2FeedbackIncorrect,
    ],
    {
      scene: {
        preset: "industrial-plant",
        titleBanner: "Why Safety is Important",
      },
      completion: {
        mode: "activities",
        required: true,
        interactionIds: [d2Question.id],
      },
      navigation: "after-completion",
      rules: [
        {
          id: "r-d2-correct",
          trigger: { event: "correct", sourceId: d2Question.id },
          actions: [
            { type: "feedback", targetId: d2FeedbackCorrect.id },
            { type: "record-result", targetId: d2Question.id },
            { type: "complete" },
          ],
        },
        {
          id: "r-d2-incorrect",
          trigger: { event: "incorrect", sourceId: d2Question.id },
          actions: [
            { type: "feedback", targetId: d2FeedbackIncorrect.id },
            { type: "record-result", targetId: d2Question.id },
          ],
        },
      ],
    },
  );

  // Demo 2 Part B: Committee Selection Single-Choice (Screenshot 4 inspired)
  const d2bQuestion = createQuestionBlock(
    "d2b:q-committee",
    "Which committee should review this issue?",
    "single-choice",
    [
      { id: "apex", text: "Apex Committee" },
      { id: "sub", text: "Sub Committee" },
      { id: "adhoc", text: "Ad-hoc Committee — Initiatives" },
    ],
    "apex",
    "main",
    "all-or-nothing",
    20,
  );
  const d2bFeedbackCorrect = createFeedbackBlock(
    "d2b:fb-correct",
    d2bQuestion.id,
    "correct",
    "Correct! The Apex Committee holds high-level governance authority for long-pending, critical organization-wide safety issues requiring decisive leadership mandate.",
    "popup",
  );
  const d2bFeedbackIncorrect = createFeedbackBlock(
    "d2b:fb-incorrect",
    d2bQuestion.id,
    "incorrect",
    "Incorrect. While Sub Committees handle tactical area-specific concerns, critical long-pending matters that require organization-wide conclusive mandates must be escalated to the Apex Committee.",
    "popup",
  );

  const demo2Committee = createComposedSlide(
    "Safety Review Structure — Committee Escalation",
    "daimler:demo2:committee-routing",
    [
      {
        ...newBlock("character", "main"),
        kind: "character",
        id: "d2b:character",
        character: "character-group",
        pose: "pointing",
        name: "Safety Team",
        alt: "Safety Officer pointing toward scenario prompt",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d2b:speech",
        contentVariant: "speech-bubble",
        speaker: "Safety Officer",
        bubbleTail: "left",
        text: "Route the safety issue to the right committee based on its focus area.",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d2b:scenario",
        contentVariant: "scenario-panel",
        title: "Safety Issue 2 of 3",
        text: "A production area has a critical, long-pending safety performance issue that needs a conclusive decision.",
      },
      d2bQuestion,
      d2bFeedbackCorrect,
      d2bFeedbackIncorrect,
    ],
    {
      scene: {
        preset: "workshop",
        titleBanner: "Safety Review Structure",
      },
      completion: {
        mode: "activities",
        required: true,
        interactionIds: [d2bQuestion.id],
      },
      navigation: "after-completion",
      rules: [
        {
          id: "r-d2b-correct",
          trigger: { event: "correct", sourceId: d2bQuestion.id },
          actions: [
            { type: "feedback", targetId: d2bFeedbackCorrect.id },
            { type: "record-result", targetId: d2bQuestion.id },
            { type: "complete" },
          ],
        },
        {
          id: "r-d2b-incorrect",
          trigger: { event: "incorrect", sourceId: d2bQuestion.id },
          actions: [
            { type: "feedback", targetId: d2bFeedbackIncorrect.id },
            { type: "record-result", targetId: d2bQuestion.id },
          ],
        },
      ],
    },
  );

  // Demo 3: Video Start Overlay & Sequencing Challenge (Screenshot 2 inspired)
  const d3Video = {
    ...newBlock("video", "main"),
    kind: "video" as const,
    id: "d3:video-briefing",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    poster: "",
    title: "Safety Culture Evolution Briefing",
    startOverlay: true,
    startButtonLabel: "Start Safety Briefing Video",
    allowSkip: true,
  };

  const d3SeqQuestion = createQuestionBlock(
    "d3:q-stages",
    "Can you arrange the four safety culture stages in the correct order (from earliest to most advanced)?",
    "sequencing",
    [
      { id: "react", text: "Reactive" },
      { id: "dep", text: "Dependant" },
      { id: "indep", text: "Independent" },
      { id: "interdep", text: "Interdependent" },
    ],
    ["react", "dep", "indep", "interdep"],
    "main",
    "all-or-nothing",
    20,
  );
  const d3SeqFeedbackCorrect = createFeedbackBlock(
    "d3:fb-correct",
    d3SeqQuestion.id,
    "correct",
    "Splendid mastery! Safety culture matures sequentially: from Reactive (instinct/compliance) → Dependant (rules/supervision) → Independent (personal ownership) → Interdependent (team vigilance and collective zero harm).",
    "popup",
  );
  const d3SeqFeedbackIncorrect = createFeedbackBlock(
    "d3:fb-incorrect",
    d3SeqQuestion.id,
    "incorrect",
    "Not quite right. Remember that safety culture progresses from compliance and supervision to individual responsibility, and ultimately to collective team ownership. Try reordering the staircase.",
    "popup",
  );

  const demo3VideoSequencing = createComposedSlide(
    "Safety Culture",
    "daimler:demo3:safety-culture",
    [
      d3Video,
      {
        ...newBlock("character", "main"),
        kind: "character",
        id: "d3:characters",
        character: "character-group",
        pose: "celebrating",
        name: "Safety Crew",
        alt: "Safety Officer, Fox Mascot, and AI Drone cheering the progression",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d3:speech",
        contentVariant: "speech-bubble",
        speaker: "Safety Officer & Mascot",
        bubbleTail: "left",
        text: "Safety Culture evolves through four stages. Can you arrange the stages in the correct order (from earliest to most advanced)?",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d3:instructions",
        contentVariant: "heading-banner",
        title: "Drag and drop the stages in the correct order (from earliest to most advanced)",
        text: "Step 1: Foundational awareness | Step 2: Supervised processes | Step 3: Individual ownership | Step 4: True team interdependence",
      },
      d3SeqQuestion,
      d3SeqFeedbackCorrect,
      d3SeqFeedbackIncorrect,
    ],
    {
      scene: {
        preset: "industrial-plant",
        titleBanner: "Safety Culture",
      },
      completion: {
        mode: "activities",
        required: true,
        interactionIds: [d3SeqQuestion.id],
      },
      navigation: "after-completion",
      rules: [
        {
          id: "r-d3-video",
          trigger: { event: "video-complete", sourceId: d3Video.id },
          actions: [{ type: "show", targetId: d3SeqQuestion.id }],
        },
        {
          id: "r-d3-correct",
          trigger: { event: "correct", sourceId: d3SeqQuestion.id },
          actions: [
            { type: "feedback", targetId: d3SeqFeedbackCorrect.id },
            { type: "record-result", targetId: d3SeqQuestion.id },
            { type: "complete" },
          ],
        },
        {
          id: "r-d3-incorrect",
          trigger: { event: "incorrect", sourceId: d3SeqQuestion.id },
          actions: [
            { type: "feedback", targetId: d3SeqFeedbackIncorrect.id },
            { type: "record-result", targetId: d3SeqQuestion.id },
          ],
        },
      ],
    },
  );

  // Slide 4: Side-by-Side Two-Column Layout (Priority 2: combinations 7, 8, 9, 12)
  const d4q1 = createQuestionBlock(
    "d4:q-ppe",
    "Which PPE is mandatory in designated machine shop corridors?",
    "single-choice",
    [
      { id: "glasses", text: "Safety eyewear & steel-toe shoes" },
      { id: "gloves", text: "Loose knit gloves" },
      { id: "none", text: "No PPE required in walkways" },
    ],
    "glasses",
    "right",
    "all-or-nothing",
    10,
  );
  const d4fb1 = createFeedbackBlock(
    "d4:fb-ppe",
    d4q1.id,
    "correct",
    "Correct: Approved safety glasses with side shields and safety boots are mandatory across all plant aisles.",
    "inline",
    "right",
  );

  const d4q2 = createQuestionBlock(
    "d4:q-hazard",
    "Select the immediate actions when noticing an oil spill near the conveyor:",
    "multi-select",
    [
      { id: "cordon", text: "Cordon off the immediate area" },
      { id: "report", text: "Report to team leader / safety desk" },
      { id: "ignore", text: "Step around it and continue" },
    ],
    ["cordon", "report"],
    "right",
    "all-or-nothing",
    10,
  );
  const d4fb2 = createFeedbackBlock(
    "d4:fb-hazard",
    d4q2.id,
    "correct",
    "Correct: Immediate containment and escalation prevent slips and severe falls.",
    "inline",
    "right",
  );

  const demo4SideBySide = createComposedSlide(
    "Shop Floor Protocol & Dual Checks",
    "daimler:demo4:side-by-side",
    [
      {
        ...newBlock("content", "left"),
        kind: "content",
        id: "d4:left-header",
        contentVariant: "scenario-panel",
        title: "Standard Operating Procedures (SOP)",
        text: "Industrial floor safety relies on continuous individual discipline. Machine shop corridors present forklift transit, overhead hoist operations, and precision machinery zones.",
      },
      {
        ...newBlock("content", "left"),
        kind: "content",
        id: "d4:left-guidelines",
        contentVariant: "speech-bubble",
        speaker: "Floor Supervisor",
        bubbleTail: "top",
        text: "Never assume someone else will report a spill or that a walkway is completely free of transient hazards. Check both protocols on the right to complete this station.",
      },
      d4q1,
      d4fb1,
      d4q2,
      d4fb2,
    ],
    {
      layout: { variant: "columns", regions: ["left", "right"] },
      scene: {
        preset: "workshop",
        titleBanner: "Shop Floor Protocol & Dual Checks",
      },
      completion: {
        mode: "activities",
        required: true,
        interactionIds: [d4q1.id, d4q2.id],
      },
      navigation: "after-completion",
      rules: [
        {
          id: "r-d4-q1-corr",
          trigger: { event: "correct", sourceId: d4q1.id },
          actions: [
            { type: "feedback", targetId: d4fb1.id },
            { type: "record-result", targetId: d4q1.id },
          ],
        },
        {
          id: "r-d4-q2-corr",
          trigger: { event: "correct", sourceId: d4q2.id },
          actions: [
            { type: "feedback", targetId: d4fb2.id },
            { type: "record-result", targetId: d4q2.id },
          ],
        },
      ],
    },
  );

  // Slide 5: Health & Recovery Station (Demonstrates Life Recovery)
  const demo5Recovery = createComposedSlide(
    "Safety Oasis — Health Recovery Station",
    "daimler:demo5:recovery",
    [
      {
        ...newBlock("character", "main"),
        kind: "character",
        id: "d5:mascot",
        character: "fox-mascot",
        pose: "celebrating",
        name: "Fox Mascot",
        alt: "Fox mascot offering a safety first-aid life boost",
      },
      {
        ...newBlock("content", "main"),
        kind: "content",
        id: "d5:speech",
        contentVariant: "speech-bubble",
        speaker: "Safety Fox",
        bubbleTail: "left",
        text: "Take a breath! You've navigated critical machine guarding and culture stages. Activate the health recharge station below to replenish your Life Meter by +25%.",
      },
      {
        ...newBlock("recovery", "main"),
        kind: "recovery",
        id: "d5:heal",
        amount: 25,
      },
      {
        ...newBlock("button", "main"),
        kind: "button",
        id: "d5:btn-complete",
        label: "Complete eModule >",
        buttonVariant: "game",
      },
    ],
    {
      scene: {
        preset: "clean-room",
        titleBanner: "Safety Oasis & Recovery",
      },
      completion: { mode: "view", required: false, interactionIds: [] },
      navigation: "free",
      rules: [
        {
          id: "r-d5-complete",
          trigger: { event: "activate", sourceId: "d5:btn-complete" },
          actions: [{ type: "complete" }],
        },
      ],
    },
  );

  c.levels = [
    {
      id: "lvl-daimler-block1",
      title: "Block 1: DICV Safety Culture & Vision Zero",
      slides: [
        demo1Content,
        demo2MultiSelect,
        demo2Committee,
        demo3VideoSequencing,
        demo4SideBySide,
        demo5Recovery,
      ],
    },
  ];

  return c;
}

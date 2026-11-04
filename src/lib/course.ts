import { z } from "zod";
import { media, color } from "./slide-primitives";
import {
  compositionSchema,
  validateCourseCompositions,
} from "./composer/schema";
export const themeSchema = z.object({
  background: color,
  section: color,
  header: color,
  navigation: color,
  text: color,
  muted: color,
  primary: color,
  buttonText: color,
  border: color,
  card: color,
  icon: color,
  life: color,
  star: color,
  font: z.enum(["Inter", "Georgia", "Arial"]),
  fontSize: z.number().min(14).max(24),
  radius: z.number().min(0).max(32),
  logo: media,
  backgroundImage: media,
});
export const slideSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    kind: z.enum([
      "content",
      "single-choice",
      "multi-select",
      "recovery",
      "composed",
    ]),
    text: z.string().max(10000).default(""),
    image: media.default(""),
    background: z.union([color, z.literal("")]).default(""),
    composition: compositionSchema.optional(),
    options: z
      .array(
        z
          .object({
            id: z.string().min(1),
            text: z.string().trim().min(1).max(500),
            image: media.optional(),
            imageAlt: z.string().max(200).optional(),
          })
          .refine((o) => !o.image || !!o.imageAlt?.trim(), {
            message: "Add alternative text for answer images",
          }),
      )
      .min(2)
      .max(6)
      .default([
        { id: "a", text: "Answer A" },
        { id: "b", text: "Answer B" },
      ]),
    mandatory: z.boolean().optional(),
    scored: z.boolean().optional(),
    lifePenalty: z.number().int().min(0).max(100).optional(),
    lifeRecovery: z.number().int().min(0).max(100).optional(),
    correctId: z.string().default("a"),
    correctIds: z.array(z.string().min(1)).min(1).max(6).optional(),
    scoringMode: z.enum(["all-or-nothing", "partial-credit"]).optional(),
    partialFeedback: z.string().min(1).max(1000).optional(),
    correctFeedback: z.string().min(1).max(1000).default("Correct"),
    incorrectFeedback: z.string().min(1).max(1000).default("Try again"),
  })
  .refine(
    (s) =>
      s.kind === "multi-select" ||
      s.kind === "composed" ||
      s.options.some((o) => o.id === s.correctId),
    {
      message: "Choose an existing correct option",
    },
  )
  .refine(
    (s) => new Set(s.options.map((o) => o.id)).size === s.options.length,
    { message: "Option IDs must be unique" },
  )
  .refine(
    (s) =>
      s.kind !== "multi-select" ||
      (!!s.correctIds?.length &&
        new Set(s.correctIds).size === s.correctIds.length &&
        s.correctIds.every((id) => s.options.some((o) => o.id === id))),
    {
      message:
        "Select at least one existing correct answer; correct answers must be unique",
    },
  )
  .refine((s) => s.kind !== "composed" || !!s.composition, {
    message: "A composed slide needs a versioned composition",
  });
export const courseSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().max(1000),
    rules: z
      .object({
        penalty: z.number().int().min(0).max(100),
        recovery: z.number().int().min(0).max(100),
        passScore: z.number().min(0).max(100),
        optionalScoring: z.enum(["include", "exclude"]).optional(),
        unansweredScoring: z.enum(["zero", "exclude-optional"]).optional(),
      })
      .optional(),
    theme: themeSchema,
    header: z.object({
      title: z.string().max(160),
      subtitle: z.string().max(200),
      showLife: z.boolean(),
      showLogo: z.boolean(),
    }),
    levels: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1).max(200),
          slides: z.array(slideSchema).max(100),
        }),
      )
      .max(100),
  })
  .superRefine((c, ctx) => {
    for (const message of validateCourseCompositions(c))
      ctx.addIssue({ code: "custom", message });
    const ids = c.levels.flatMap((l) => [l.id, ...l.slides.map((s) => s.id)]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Level and slide IDs must be unique",
      });
  });
export type CourseData = z.infer<typeof courseSchema>;
export type Slide = CourseData["levels"][number]["slides"][number];
export const defaultTheme: CourseData["theme"] = {
  background: "#F1F5F9",
  section: "#FFFFFF",
  header: "#123347",
  navigation: "#2563EB",
  text: "#0F172A",
  muted: "#64748B",
  primary: "#2563EB",
  buttonText: "#FFFFFF",
  border: "#CBD5E1",
  card: "#FFFFFF",
  icon: "#2563EB",
  life: "#16A34A",
  star: "#D97706",
  font: "Inter",
  fontSize: 16,
  radius: 16,
  logo: "",
  backgroundImage: "",
};
export const presets = {
  "Daimler Truck (provisional)": {
    ...defaultTheme,
    header: "#123347",
    primary: "#087E8B",
    navigation: "#087E8B",
    icon: "#087E8B",
  },
  "BharatBenz (provisional)": {
    ...defaultTheme,
    header: "#1F2937",
    primary: "#DC2626",
    navigation: "#DC2626",
    icon: "#DC2626",
  },
};
export function newSlide(title = "Untitled slide"): Slide {
  return {
    id: crypto.randomUUID(),
    title,
    kind: "content",
    text: "Add your learning content here.",
    image: "",
    background: "",
    options: [
      { id: "a", text: "Demonstration option A" },
      { id: "b", text: "Demonstration option B" },
    ],
    correctId: "a",
    correctFeedback: "Correct — demonstration feedback.",
    incorrectFeedback:
      "Try again — demonstration feedback. Review the content before continuing.",
  };
}
export function newCourse(title: string): CourseData {
  return {
    title,
    description: "",
    theme: { ...defaultTheme },
    header: {
      title,
      subtitle: "Interactive learning experience",
      showLife: true,
      showLogo: true,
    },
    levels: [
      {
        id: crypto.randomUUID(),
        title: "Level 01 — Getting started",
        slides: [newSlide("Welcome")],
      },
    ],
  };
}
export function demoCourse(): CourseData {
  const c = newCourse("Daimler EHS");
  c.description =
    "A shared commitment to a safer tomorrow. Explore the foundations of Vision Zero.";
  c.theme = { ...presets["Daimler Truck (provisional)"] };
  c.header.title = "Daimler EHS";
  c.header.subtitle = "Vision Zero · Demonstration course";
  c.levels = [
    {
      id: crypto.randomUUID(),
      title: "Level 01 — EHS Vision & Strategy",
      slides: [
        {
          ...newSlide("Welcome to Vision Zero"),
          text: "A safer tomorrow starts with us.\n\nExplore our shared vision for a safe and healthy workplace. This is demonstration content and must be reviewed before training use.",
        },
        {
          ...newSlide("Three Pillars of Vision Zero"),
          text: "People. Prevention. Participation.\n\nThese are illustrative learning pillars, not approved corporate safety guidance. Replace this content with your verified training material.",
        },
        {
          ...newSlide("Vision Zero Challenge"),
          kind: "single-choice",
          text: "Demonstration question: which option is labeled A? This checks the interaction only; it is not a safety assessment.",
        },
      ],
    },
  ];
  return c;
}

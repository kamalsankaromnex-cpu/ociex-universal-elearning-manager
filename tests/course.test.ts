import { describe, it, expect } from "vitest";
import {
  courseSchema,
  demoCourse,
  newCourse,
  submitAnswer,
} from "../src/lib/course";
describe("canonical course model", () => {
  it("seeds the three requested editable demonstration slides", () => {
    const c = demoCourse();
    expect(courseSchema.parse(c)).toEqual(c);
    expect(c.levels[0].slides.map((s) => s.title)).toEqual([
      "Welcome to Vision Zero",
      "Three Pillars of Vision Zero",
      "Vision Zero Challenge",
    ]);
  });
  it("creates independent courses, theme objects and identifiers", () => {
    const a = newCourse("A"),
      b = newCourse("B");
    a.theme.primary = "#000000";
    expect(b.theme.primary).not.toBe(a.theme.primary);
    expect(a.levels[0].id).not.toBe(b.levels[0].id);
  });
  it("rejects invalid answer keys, duplicated IDs and invalid colors", () => {
    const c = demoCourse();
    c.levels[0].slides[2].correctId = "missing";
    expect(courseSchema.safeParse(c).success).toBe(false);
    const d = demoCourse();
    d.levels.push(d.levels[0]);
    expect(courseSchema.safeParse(d).success).toBe(false);
    d.theme.life = "red";
    expect(courseSchema.safeParse(d).success).toBe(false);
  });
});
describe("independent temporary game state", () => {
  it("starts at 100 and penalizes first incorrect submission by 25 once", () => {
    const s = demoCourse().levels[0].slides[2];
    const initial = { life: 100, penalized: [] };
    const wrong = submitAnswer(initial, s, "b");
    expect(wrong.life).toBe(75);
    expect(initial.life).toBe(100);
    expect(submitAnswer(wrong, s, "b").life).toBe(75);
    expect(submitAnswer(wrong, s, "a").life).toBe(75);
  });
  it("never penalizes correct answers and clamps life at zero", () => {
    const s = demoCourse().levels[0].slides[2];
    expect(submitAnswer({ life: 100, penalized: [] }, s, "a").life).toBe(100);
    expect(submitAnswer({ life: 10, penalized: [] }, s, "b").life).toBe(0);
  });
});
it("ignores non-qualifying submissions", () => {
  const c = demoCourse();
  const state = { life: 100, penalized: [] };
  expect(submitAnswer(state, c.levels[0].slides[0], "b")).toBe(state);
  expect(submitAnswer(state, c.levels[0].slides[2], "unknown")).toBe(state);
});

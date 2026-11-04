import { describe, it, expect } from "vitest";
import { newCourse, newSlide } from "../src/lib/course";
import {
  initialGame,
  visit,
  answerQuestion,
  recoverLife,
  retryLevel,
  assessment,
  finishGame,
} from "../src/lib/game";
function fixture() {
  const c = newCourse("Game");
  c.levels[0].slides = [
    { ...newSlide("Question"), kind: "single-choice", lifePenalty: 100 },
    { ...newSlide("Recovery"), kind: "recovery", lifeRecovery: 40 },
  ];
  c.levels.push({
    id: crypto.randomUUID(),
    title: "Second",
    slides: [{ ...newSlide("Second question"), kind: "single-choice" }],
  });
  return c;
}
describe("canonical shared game", () => {
  it("requires mandatory competencies independently of life and visitation", () => {
    const c = fixture();
    let s = visit(c, initialGame(), 0);
    s = visit(c, s, 1);
    s = visit(c, s, 2);
    expect(s.life).toBe(100);
    expect(assessment(c, s).eligible).toBe(false);
    expect(finishGame(c, s).finished).toBe(false);
  });
  it("penalizes a qualifying wrong answer once and retries only the current level", () => {
    const c = fixture();
    let s = visit(c, initialGame(), 0);
    s = answerQuestion(c, s, "b");
    expect(s.life).toBe(0);
    expect(answerQuestion(c, s, "a").passed).toEqual([]);
    s = retryLevel(c, s);
    expect(s.life).toBe(100);
    expect(s.index).toBe(0);
    expect(s.attempts).toBe(1);
  });
  it("does not penalize invalid answers or content slides; repeat penalty is idempotent", () => {
    const c = fixture();
    c.levels[0].slides[0].lifePenalty = 25;
    let s = visit(c, initialGame(), 0);
    expect(answerQuestion(c, s, "missing")).toBe(s);
    s = answerQuestion(c, s, "b");
    expect(s.life).toBe(75);
    expect(answerQuestion(c, s, "b").life).toBe(75);
    s = visit(c, s, 1);
    expect(answerQuestion(c, s, "b")).toBe(s);
  });
  it("restores configured life once and caps at 100", () => {
    const c = fixture();
    c.levels[0].slides[0].lifePenalty = 25;
    let s = answerQuestion(c, visit(c, initialGame(), 0), "b");
    s = visit(c, s, 1);
    s = recoverLife(c, s);
    expect(s.life).toBe(100);
    expect(recoverLife(c, s)).toBe(s);
  });
  it("shares life/stars across levels, preserving prior stars on retry", () => {
    const c = fixture();
    let s = answerQuestion(c, visit(c, initialGame(), 0), "a");
    s = visit(c, s, 1);
    expect(s.stars).toEqual([0]);
    s = visit(c, s, 2);
    s = answerQuestion(c, s, "b");
    expect(s.life).toBe(75);
    expect(s.stars).toEqual([0]);
    s = retryLevel(c, s);
    expect(s.stars).toEqual([0]);
    expect(s.passed).toContain(0);
    s = visit(c, s, 2);
    s = answerQuestion(c, s, "a");
    expect(s.stars).toEqual([0, 1]);
    expect(finishGame(c, s).finished).toBe(true);
  });
  it("supports optional assessment failure while mandatory conditions remain satisfied", () => {
    const c = fixture();
    c.levels = [
      {
        ...c.levels[0],
        slides: [
          { ...newSlide("Optional"), kind: "single-choice", mandatory: false },
        ],
      },
    ];
    let s = visit(c, initialGame(), 0);
    s = answerQuestion(c, s, "b");
    s = finishGame(c, s);
    expect(s.finished).toBe(true);
    expect(assessment(c, s).success).toBe(false);
  });
});

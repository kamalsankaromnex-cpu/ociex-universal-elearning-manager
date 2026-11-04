import { gameStateSchema, type LearnerGameState } from "../game";
import type { ScormVersion } from "./types";
function bits(indices: number[], count: number) {
  const bytes = new Uint8Array(Math.ceil(count / 8));
  for (const i of indices) {
    if (i >= count) throw new Error("Resume index outside package");
    bytes[i >> 3] |= 1 << (i % 8);
  }
  return btoa(String.fromCharCode(...bytes));
}
function indices(value: unknown, count: number) {
  if (
    typeof value !== "string" ||
    value.length !== 4 * Math.ceil(Math.ceil(count / 8) / 3)
  )
    throw new Error("Invalid resume bitset");
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  if (bytes.length !== Math.ceil(count / 8))
    throw new Error("Invalid resume length");
  return Array.from({ length: count }, (_, i) => i).filter(
    (i) => bytes[i >> 3] & (1 << (i % 8)),
  );
}
export class ResumeStateSerializer {
  static limit(version: ScormVersion) {
    return version === "1.2" ? 4096 : 64000;
  }
  static serialize(
    state: LearnerGameState,
    fingerprint: string,
    slideCount: number,
    levelCount: number,
    version: ScormVersion,
  ) {
    const s = gameStateSchema.parse(state);
    const text = JSON.stringify([
      1,
      fingerprint,
      s.life,
      s.index,
      s.attempts,
      s.finished ? 1 : 0,
      ...[s.visited, s.passed, s.penalized, s.recovered].map((x) =>
        bits(x, slideCount),
      ),
      bits(s.completedLevels, levelCount),
      bits(s.stars, levelCount),
    ]);
    if (text.length > this.limit(version))
      throw new Error("Resume data exceeds SCORM limit");
    return text;
  }
  static deserialize(
    text: string,
    fingerprint: string,
    slideCount: number,
    levelCount: number,
    version: ScormVersion,
  ): LearnerGameState {
    if (text.length > this.limit(version))
      throw new Error("LMS resume data exceeds SCORM limit");
    const p: unknown = JSON.parse(text);
    if (
      !Array.isArray(p) ||
      p.length !== 12 ||
      p[0] !== 1 ||
      p[1] !== fingerprint ||
      (p[5] !== 0 && p[5] !== 1)
    )
      throw new Error(
        "Resume data belongs to a different package or is invalid",
      );
    const state = gameStateSchema.parse({
      life: p[2],
      index: p[3],
      attempts: p[4],
      finished: p[5] === 1,
      visited: indices(p[6], slideCount),
      passed: indices(p[7], slideCount),
      penalized: indices(p[8], slideCount),
      recovered: indices(p[9], slideCount),
      completedLevels: indices(p[10], levelCount),
      stars: indices(p[11], levelCount),
    });
    if (state.index >= slideCount) throw new Error("Invalid resume bookmark");
    return state;
  }
}

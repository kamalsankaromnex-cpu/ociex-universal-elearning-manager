import {
  encodeComposer,
  decodeComposer,
  type ComposerContext,
} from "../composer/codec";
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
    context?: ComposerContext,
  ) {
    const s = gameStateSchema.parse(state);
    const multi =
      s.multi === undefined
        ? undefined
        : Object.entries(s.multi)
            .sort(([a], [b]) => Number(a) - Number(b))
            .flatMap(([key, value]) => {
              const index = Number(key);
              if (index >= slideCount)
                throw new Error("Resume question outside package");
              return [index, value.selection, value.credit];
            });
    const text = JSON.stringify([
      s.composer ? 3 : multi === undefined ? 1 : 2,
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
      ...(s.composer
        ? [
            multi ?? [],
            encodeComposer(
              s.composer,
              context ??
                (() => {
                  throw Error("Composer resume context is required");
                })(),
            ),
          ]
        : multi === undefined
          ? []
          : [multi]),
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
    context?: ComposerContext,
  ): LearnerGameState {
    if (text.length > this.limit(version))
      throw new Error("LMS resume data exceeds SCORM limit");
    const p: unknown = JSON.parse(text);
    if (
      !Array.isArray(p) ||
      !(
        (p[0] === 1 && p.length === 12) ||
        (p[0] === 2 && p.length === 13) ||
        (p[0] === 3 && p.length === 14)
      ) ||
      p[1] !== fingerprint ||
      (p[5] !== 0 && p[5] !== 1)
    )
      throw new Error(
        "Resume data belongs to a different package or is invalid",
      );
    let multi:
      Record<string, { selection: number; credit: number }> | undefined;
    if (p[0] === 2 || p[0] === 3) {
      const values = p[12];
      if (
        !Array.isArray(values) ||
        values.length % 3 ||
        values.length > slideCount * 3
      )
        throw new Error("Invalid multi-select resume data");
      multi = {};
      for (let i = 0; i < values.length; i += 3) {
        const index = values[i];
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= slideCount ||
          Object.hasOwn(multi, index)
        )
          throw new Error("Invalid multi-select resume question");
        multi[index] = { selection: values[i + 1], credit: values[i + 2] };
      }
    }
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
      ...(multi === undefined || (p[0] === 3 && !Object.keys(multi).length)
        ? {}
        : { multi }),
      ...(p[0] === 3
        ? {
            composer: decodeComposer(
              p[13],
              context ??
                (() => {
                  throw Error("Composer resume context is required");
                })(),
            ),
          }
        : {}),
    });
    if (state.index >= slideCount) throw new Error("Invalid resume bookmark");
    return state;
  }
}

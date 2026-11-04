import { composerStateSchema, type ComposerState } from "./state";
export type ComposerContext = { blocks: string[]; slides: string[] };
const outcomes = ["correct", "incorrect", "partial", "retry"] as const;
export function encodeComposer(state: ComposerState, context: ComposerContext) {
  const blockIndices = new Map(context.blocks.map((id, index) => [id, index]));
  const slideIndices = new Map(context.slides.map((id, index) => [id, index]));
  const index = (id: string, slide = false) => {
    const i = (slide ? slideIndices : blockIndices).get(id);
    if (i === undefined) throw Error("Unknown composer resume reference");
    return i;
  };
  return [
    Object.entries(state.answers).flatMap(([id, a]) => [
      index(id),
      a.selection,
      a.credit,
      (a.passed ? 1 : 0) | (a.penalized ? 2 : 0),
      outcomes.indexOf(a.last),
    ]),
    Object.entries(state.visibility).flatMap(([id, v]) => [
      index(id),
      v ? 1 : 0,
    ]),
    state.seen.map((id) => index(id)),
    state.manual.map((id) => index(id, true)),
    state.feedback.map((id) => index(id)),
    state.recovered.map((id) => index(id)),
  ];
}
export function decodeComposer(
  value: unknown,
  context: ComposerContext,
): ComposerState {
  if (
    !Array.isArray(value) ||
    value.length !== 6 ||
    value.some((x) => !Array.isArray(x))
  )
    throw Error("Invalid composer resume payload");
  const [answers, visibility, seen, manual, feedback, recovered] =
    value as unknown[][];
  if (
    answers.length % 5 ||
    answers.length > context.blocks.length * 5 ||
    visibility.length % 2 ||
    visibility.length > context.blocks.length * 2
  )
    throw Error("Invalid composer resume length");
  const id = (n: unknown, slide = false) => {
    const ids = slide ? context.slides : context.blocks;
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < 0 ||
      n >= ids.length
    )
      throw Error("Invalid composer resume index");
    return ids[n];
  };
  const records: ComposerState["answers"] = {};
  for (let i = 0; i < answers.length; i += 5) {
    const key = id(answers[i]),
      flags = answers[i + 3],
      outcome = answers[i + 4];
    if (
      Object.hasOwn(records, key) ||
      typeof flags !== "number" ||
      !Number.isInteger(flags) ||
      flags < 0 ||
      flags > 3 ||
      typeof outcome !== "number" ||
      !Number.isInteger(outcome) ||
      outcome < 0 ||
      outcome > 3
    )
      throw Error("Invalid composer answer flags");
    records[key] = {
      selection: answers[i + 1] as number,
      credit: answers[i + 2] as number,
      passed: !!(flags & 1),
      penalized: !!(flags & 2),
      last: outcomes[outcome],
    };
  }
  const visible: Record<string, boolean> = {};
  for (let i = 0; i < visibility.length; i += 2) {
    const key = id(visibility[i]);
    if (
      Object.hasOwn(visible, key) ||
      ![0, 1].includes(visibility[i + 1] as number)
    )
      throw Error("Invalid composer visibility");
    visible[key] = visibility[i + 1] === 1;
  }
  const list = (items: unknown[], slide = false) => {
    if (items.length > (slide ? context.slides : context.blocks).length)
      throw Error("Invalid composer state list");
    const result = items.map((i) => id(i, slide));
    if (new Set(result).size !== result.length)
      throw Error("Duplicate composer state reference");
    return result;
  };
  return composerStateSchema.parse({
    answers: records,
    visibility: visible,
    seen: list(seen),
    manual: list(manual, true),
    feedback: list(feedback),
    recovered: list(recovered),
  });
}

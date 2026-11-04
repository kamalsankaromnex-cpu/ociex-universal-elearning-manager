import { z } from "zod";
export const outcomeSchema = z.enum([
  "correct",
  "incorrect",
  "partial",
  "retry",
]);
export const composerStateSchema = z.object({
  answers: z.record(
    z.string(),
    z.object({
      selection: z.number().int().min(0).max(63),
      credit: z.number().int().min(0).max(10000),
      passed: z.boolean(),
      penalized: z.boolean(),
      last: outcomeSchema,
    }),
  ),
  visibility: z.record(z.string(), z.boolean()),
  seen: z.array(z.string()),
  manual: z.array(z.string()),
  feedback: z.array(z.string()),
  recovered: z.array(z.string()),
});
export type ComposerState = z.infer<typeof composerStateSchema>;
export const emptyComposer = (): ComposerState => ({
  answers: {},
  visibility: {},
  seen: [],
  manual: [],
  feedback: [],
  recovered: [],
});

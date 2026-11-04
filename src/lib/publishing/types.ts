import { z } from "zod";
export const PUBLISHER_VERSION = "composer.1";
export const exportRequestSchema = z
  .object({
    revision: z.number().int().positive(),
    version: z.enum(["1.2", "2004"]),
    scope: z.enum(["level", "course"]),
    levelId: z.string().optional(),
  })
  .refine((x) => x.scope === "course" || !!x.levelId, {
    message: "Choose a level for a level export",
  });
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ValidationResult = { errors: string[]; warnings: string[] };

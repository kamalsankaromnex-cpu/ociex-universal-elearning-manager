import { z } from "zod";
export const acceptanceSchema = z
  .object({
    platform: z.string().trim().min(1).max(120),
    edition: z.enum(["1.2", "2004"]),
    testedVersion: z.string().trim().min(1).max(160),
    tester: z.string().trim().min(1).max(120),
    testedAt: z.iso
      .datetime()
      .refine(
        (v) => new Date(v).getTime() <= Date.now() + 60000,
        "Test date cannot be in the future",
      ),
    result: z.enum(["passed", "failed", "blocked", "unverified"]),
    evidence: z.string().trim().min(1).max(8000),
    importVerified: z.boolean(),
    launchVerified: z.boolean(),
    debugVerified: z.boolean(),
  })
  .superRefine((record, ctx) => {
    if (
      record.result === "passed" &&
      (!record.importVerified ||
        !record.launchVerified ||
        !record.debugVerified ||
        record.evidence.length < 20)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "A passed record requires actual import, launch, debug verification and at least 20 characters of evidence.",
      });
  });

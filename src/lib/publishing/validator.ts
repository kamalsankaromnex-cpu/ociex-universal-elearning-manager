import { courseSchema, type CourseData } from "../course";
import { flatten, initialGame } from "../game";
import { ResumeStateSerializer } from "../scorm/resume";
import type { ExportRequest, ValidationResult } from "./types";
export class ExportValidator {
  validate(data: unknown, request: ExportRequest): ValidationResult {
    const parsed = courseSchema.safeParse(data);
    if (!parsed.success)
      return {
        errors: parsed.error.issues.map((i) => i.message),
        warnings: [],
      };
    const course = parsed.data,
      errors: string[] = [],
      warnings = [
        "Demonstration answer keys and provisional brand colors require content-owner approval.",
        "Single SCO: advanced multi-SCO sequencing is not included.",
      ];
    const count = flatten(course).length;
    if (!count) errors.push("Add at least one slide before publishing.");
    if (course.levels.some((l) => !l.slides.length))
      errors.push("Every exported level must have a slide.");
    if (request.version === "1.2" && count > 1024)
      errors.push(
        "SCORM 1.2 supports up to 1024 slides in this publisher to guarantee resume capacity.",
      );
    if (request.version === "2004" && count > 10000)
      errors.push("SCORM 2004 supports up to 10000 slides.");
    for (const value of [course.title, ...course.levels.map((l) => l.title)])
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))
        errors.push(
          "Remove unsupported control characters from course and level titles.",
        );
    for (const value of [
      course.theme.logo,
      course.theme.backgroundImage,
      ...flatten(course).map((s) => s.image),
    ])
      if (value && !value.startsWith("data:image/"))
        errors.push("Re-upload missing media before exporting.");
    for (const slide of flatten(course))
      for (const text of [
        slide.title,
        slide.text,
        ...slide.options.map((o) => o.text),
        slide.correctFeedback,
        slide.incorrectFeedback,
      ])
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))
          errors.push(
            "Remove unsupported control characters from course text.",
          );
    try {
      const full = Array.from({ length: count }, (_, i) => i),
        levels = course.levels.map((_, i) => i);
      ResumeStateSerializer.serialize(
        {
          ...initialGame(),
          visited: full,
          passed: full,
          penalized: full,
          recovered: full,
          completedLevels: levels,
          stars: levels,
        },
        "f".repeat(64),
        count,
        levels.length,
        request.version,
      );
    } catch (e) {
      errors.push((e as Error).message);
    }
    return { errors: [...new Set(errors)], warnings };
  }
  select(data: CourseData, request: ExportRequest) {
    if (request.scope === "course") return data;
    const level = data.levels.find((l) => l.id === request.levelId);
    if (!level) throw new Error("Selected level is unavailable");
    return { ...data, levels: [level] };
  }
}

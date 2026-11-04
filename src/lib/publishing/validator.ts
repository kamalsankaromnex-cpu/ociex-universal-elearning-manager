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
    for (const slide of flatten(course)) {
      if (slide.kind === "content" && !slide.text.trim() && !slide.image)
        errors.push(`Slide "${slide.title}" needs text or an image.`);
      if (
        slide.kind === "single-choice" &&
        (!slide.text.trim() ||
          slide.options.some((o) => !o.text.trim()) ||
          !slide.correctId)
      )
        errors.push(
          `Question "${slide.title}" needs a prompt, answer options and a correct answer.`,
        );
    }
    for (const value of [
      course.theme.logo,
      course.theme.backgroundImage,
      ...flatten(course).map((s) => s.image),
    ].filter(Boolean)) {
      const match =
        /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
          value,
        );
      if (!match) continue; // Missing/non-embedded assets were reported above.
      const bytes = Buffer.from(match[2], "base64");
      const valid =
        match[1] === "png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : match[1] === "jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : match[1] === "gif"
              ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
              : bytes.subarray(0, 4).toString() === "RIFF" &&
                bytes.subarray(8, 12).toString() === "WEBP";
      if (!valid || bytes.length < 12)
        errors.push(
          "An uploaded asset does not match its image type. Re-upload the image.",
        );
    }
    if (
      !flatten(course).some(
        (s) =>
          s.kind === "single-choice" &&
          s.scored !== false &&
          (s.mandatory !== false ||
            course.rules?.optionalScoring !== "exclude"),
      )
    )
      warnings.push(
        "No scored questions: the reported score is 100%; completion still requires all mandatory competencies.",
      );
    warnings.push(
      `Passing score: ${course.rules?.passScore ?? 80}%. Optional questions: ${course.rules?.optionalScoring ?? "include"}. Unanswered questions: ${course.rules?.unansweredScoring ?? "zero"}. Unscored questions are excluded.`,
    );
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

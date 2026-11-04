import { composerContext, compositionMedia } from "../composer/model";
import { emptyComposer } from "../composer/state";
import { isQuestion } from "../interactions";
import { courseSchema, type CourseData } from "../course";
import { flatten, initialGame, allQuestions } from "../game";
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
      ...flatten(course).flatMap((s) => [
        s.image,
        ...s.options.map((o) => o.image ?? ""),
        ...(s.composition ? compositionMedia(s.composition) : []),
      ]),
    ])
      if (value && !value.startsWith("data:image/"))
        errors.push("Re-upload missing media before exporting.");
    for (const slide of flatten(course)) {
      if (slide.kind === "content" && !slide.text.trim() && !slide.image)
        errors.push(`Slide "${slide.title}" needs text or an image.`);
      if (
        isQuestion(slide) &&
        (!slide.text.trim() ||
          slide.options.some((o) => !o.text.trim()) ||
          (slide.kind === "multi-select"
            ? !slide.correctIds?.length
            : !slide.correctId))
      )
        errors.push(
          `Question "${slide.title}" needs a prompt, answer options and a correct answer.`,
        );
    }
    for (const value of [
      course.theme.logo,
      course.theme.backgroundImage,
      ...flatten(course).flatMap((s) => [
        s.image,
        ...s.options.map((o) => o.image ?? ""),
        ...(s.composition ? compositionMedia(s.composition) : []),
      ]),
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
      !allQuestions(course).some(
        ({ question: s }) =>
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
        slide.partialFeedback ?? "",
        ...slide.options.map((o) => o.imageAlt ?? ""),
        ...(slide.composition?.blocks.flatMap((b) =>
          b.kind === "content" || b.kind === "feedback"
            ? [b.text]
            : b.kind === "interaction"
              ? [b.question.prompt, ...b.question.options.map((o) => o.text)]
              : b.kind === "media"
                ? [b.alt]
                : b.kind === "button"
                  ? [b.label]
                  : [],
        ) ?? []),
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
          ...(flatten(course).some((s) => s.composition)
            ? {
                composer: {
                  ...emptyComposer(),
                  answers: Object.fromEntries(
                    flatten(course).flatMap(
                      (s) =>
                        s.composition?.blocks.flatMap((b) =>
                          b.kind === "interaction"
                            ? [
                                [
                                  b.id,
                                  {
                                    selection:
                                      (1 << b.question.options.length) - 1,
                                    credit: 10000,
                                    passed: true,
                                    penalized: true,
                                    last: "correct" as const,
                                  },
                                ],
                              ]
                            : [],
                        ) ?? [],
                    ),
                  ),
                  visibility: Object.fromEntries(
                    composerContext(course).blocks.map((id) => [id, true]),
                  ),
                  seen: composerContext(course).blocks,
                  manual: flatten(course)
                    .filter((s) => s.composition)
                    .map((s) => s.id),
                  feedback: composerContext(course).blocks,
                  recovered: composerContext(course).blocks,
                },
              }
            : {}),
          visited: full,
          passed: full,
          penalized: full,
          recovered: full,
          completedLevels: levels,
          stars: levels,
          ...(flatten(course).some((s) => s.kind === "multi-select")
            ? {
                multi: Object.fromEntries(
                  flatten(course).flatMap((s, i) =>
                    s.kind === "multi-select"
                      ? [
                          [
                            i,
                            {
                              selection: (1 << s.options.length) - 1,
                              credit: 10000,
                            },
                          ],
                        ]
                      : [],
                  ),
                ),
              }
            : {}),
        },
        "f".repeat(64),
        count,
        levels.length,
        request.version,
        composerContext(course),
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

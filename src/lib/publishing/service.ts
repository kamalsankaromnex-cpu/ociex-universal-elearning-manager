import { createHash } from "node:crypto";
import { courseSchema } from "../course";
import { db } from "../db";
import { PackageBuilder } from "./package-builder";
import { ExportValidator } from "./validator";
import { exportRequestSchema, type ExportRequest } from "./types";
export class ExportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export class CourseExportService {
  constructor(private builder = new PackageBuilder()) {}
  async snapshot(adminId: string, id: string, input: unknown) {
    const parsed = exportRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new ExportError(parsed.error.issues[0].message, 400);
    const request = parsed.data;
    const record = await db.course.findFirst({ where: { id, adminId } });
    if (!record) throw new ExportError("Course is unavailable", 404);
    if (record.revision !== request.revision)
      throw new ExportError(
        "Saved revision changed. Save or reopen the course before exporting.",
        409,
      );
    const parsedCourse = courseSchema.safeParse(record.data);
    if (!parsedCourse.success)
      throw new ExportError(
        "Saved course failed validation. Reopen, correct and save it.",
        422,
      );
    const validator = new ExportValidator();
    let course;
    try {
      course = validator.select(parsedCourse.data, request);
    } catch (e) {
      throw new ExportError((e as Error).message, 422);
    }
    const validation = validator.validate(course, request);
    return { course, request, validation };
  }
  async export(adminId: string, id: string, input: ExportRequest) {
    const snapshot = await this.snapshot(adminId, id, input);
    if (snapshot.validation.errors.length)
      throw new ExportError(snapshot.validation.errors.join(" "), 422);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          publisherVersion: "phase2.1",
          revision: snapshot.request.revision,
          scope: snapshot.request.scope,
          version: snapshot.request.version,
          course: snapshot.course,
        }),
      )
      .digest("hex");
    const result = await this.builder.build(
      snapshot.course,
      snapshot.request,
      fingerprint,
    );
    const latest = await db.course.findFirst({
      where: { id, adminId },
      select: { revision: true },
    });
    if (!latest || latest.revision !== snapshot.request.revision)
      throw new ExportError(
        "Course changed during export. Retry with the latest saved revision.",
        409,
      );
    return { ...result, validation: snapshot.validation };
  }
}

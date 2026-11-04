import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { CourseExportService, ExportError } from "./service";
import type { ExportRequest } from "./types";

export const historySelect = {
  id: true,
  revision: true,
  revisionIdentifier: true,
  version: true,
  scope: true,
  levelTitle: true,
  fingerprint: true,
  status: true,
  error: true,
  createdAt: true,
  sha256: true,
  bytes: true,
  metadata: true,
  validation: true,
  acceptances: { orderBy: { createdAt: "desc" as const }, take: 50 },
} satisfies Prisma.PublishedExportSelect;

export async function publishCourse(
  adminId: string,
  courseId: string,
  input: ExportRequest,
) {
  const service = new CourseExportService();
  const snapshot = await service.snapshot(adminId, courseId, input);
  const base = {
    courseId,
    revision: snapshot.request.revision,
    revisionIdentifier: `${courseId}:r${snapshot.request.revision}`,
    version: snapshot.request.version,
    scope: snapshot.request.scope,
    levelId:
      snapshot.request.scope === "level" ? snapshot.request.levelId : null,
    levelTitle:
      snapshot.request.scope === "level"
        ? snapshot.course.levels[0].title
        : null,
    snapshot: snapshot.course as Prisma.InputJsonValue,
    validation: snapshot.validation as Prisma.InputJsonValue,
  };
  try {
    const result = await service.export(adminId, courseId, input);
    const sha256 = createHash("sha256").update(result.zip).digest("hex");
    const record = await db.$transaction(async (tx) => {
      // Serialize final publication with saves/deletes so a changed revision
      // cannot slip between the final check and archive insertion.
      const rows = await tx.$queryRaw<
        Array<{ revision: number }>
      >`SELECT revision FROM "Course" WHERE id = ${courseId} AND "adminId" = ${adminId} FOR SHARE`;
      if (rows[0]?.revision !== snapshot.request.revision)
        throw new ExportError(
          "Course changed during export. Revalidate the latest saved revision.",
          409,
        );
      return tx.publishedExport.create({
        data: {
          ...base,
          status: "ready",
          fingerprint: result.metadata.fingerprint,
          metadata: result.metadata,
          zip: new Uint8Array(result.zip),
          sha256,
          bytes: result.zip.length,
        },
        select: historySelect,
      });
    });
    return { ...result, record };
  } catch (error) {
    try {
      await db.publishedExport.create({
        data: {
          ...base,
          status: "failed",
          fingerprint: "",
          metadata: {},
          error: "Export failed. Revalidate the saved revision and retry.",
        },
      });
    } catch {
      console.error("Publishing failure record could not be saved");
    }
    throw error;
  }
}

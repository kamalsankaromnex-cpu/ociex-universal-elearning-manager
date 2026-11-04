import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; exportId: string }> },
) {
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id, exportId } = await params;
  const record = await db.publishedExport.findFirst({
    where: { id: exportId, courseId: id, course: { adminId: admin.id } },
    select: {
      id: true,
      zip: true,
      status: true,
      sha256: true,
      revision: true,
      version: true,
    },
  });
  if (!record || record.status !== "ready" || !record.zip)
    return NextResponse.json(
      { error: "Download unavailable" },
      { status: 404 },
    );
  if (createHash("sha256").update(record.zip).digest("hex") !== record.sha256)
    return NextResponse.json(
      { error: "Artifact integrity check failed; export a new package." },
      { status: 500 },
    );
  return new Response(new Uint8Array(record.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="export-${record.id}-r${record.revision}-scorm${record.version === "1.2" ? "12" : "2004"}.zip"`,
      "Cache-Control": "no-store",
      "X-Artifact-SHA256": record.sha256!,
    },
  });
}

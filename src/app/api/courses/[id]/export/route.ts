import { NextResponse } from "next/server";
import { currentAdmin, sameOrigin } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { CourseExportService, ExportError } from "@/lib/publishing/service";
export const runtime = "nodejs";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const input = await readJson(req, 16384);
  if (!input.ok) return input.response;
  try {
    const service = new CourseExportService(),
      { id } = await params;
    const body = input.data as Record<string, unknown>;
    if (body?.validateOnly) {
      const result = await service.snapshot(admin.id, id, body);
      return NextResponse.json({
        revision: result.request.revision,
        ...result.validation,
      });
    }
    const result = await service.export(admin.id, id, body as never);
    return new Response(new Uint8Array(result.zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="course-r${result.metadata.revision}-${result.metadata.scope}-scorm${result.metadata.format.includes("1.2") ? "12" : "2004"}.zip"`,
        "Cache-Control": "no-store",
        "X-Course-Revision": String(result.metadata.revision),
        "X-Export-Fingerprint": result.metadata.fingerprint,
      },
    });
  } catch (e) {
    if (e instanceof ExportError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(
      "Course export failed:",
      e instanceof Error ? e.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Package generation failed. Check server logs and retry." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { currentAdmin, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { acceptanceSchema } from "@/lib/publishing/acceptance";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; exportId: string }> },
) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id, exportId } = await params;
  const exported = await db.publishedExport.findFirst({
    where: { id: exportId, courseId: id, course: { adminId: admin.id } },
    select: { id: true, version: true, status: true },
  });
  if (!exported || exported.status !== "ready")
    return NextResponse.json(
      { error: "Published export unavailable" },
      { status: 404 },
    );
  const body = await readJson(req, 20000);
  if (!body.ok) return body.response;
  const parsed = acceptanceSchema.safeParse(body.data);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  if (parsed.data.edition !== exported.version)
    return NextResponse.json(
      { error: "Edition must match the tested export" },
      { status: 400 },
    );
  const record = await db.lmsAcceptance.create({
    data: {
      ...parsed.data,
      testedAt: new Date(parsed.data.testedAt),
      exportId,
    },
  });
  return NextResponse.json(record, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}

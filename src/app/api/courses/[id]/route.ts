import { z } from "zod";
import { readJson } from "@/lib/http";
import { NextResponse } from "next/server";
import { currentAdmin, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { courseSchema } from "@/lib/course";
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const body = await readJson(req);
  if (!body.ok) return body.response;
  const parsed = z
    .object({ data: courseSchema, revision: z.number().int().positive() })
    .safeParse(body.data);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const result = await db.course.updateMany({
    where: { id, adminId: admin.id, revision: parsed.data.revision },
    data: {
      title: parsed.data.data.title,
      data: parsed.data.data,
      revision: { increment: 1 },
    },
  });
  if (!result.count)
    return NextResponse.json(
      { error: "Course changed or unavailable. Reopen it before saving." },
      { status: 409 },
    );
  return NextResponse.json(
    await db.course.findFirst({ where: { id, adminId: admin.id } }),
  );
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const result = await db.course.deleteMany({
    where: { id, adminId: admin.id },
  });
  return NextResponse.json(
    { ok: result.count > 0 },
    { status: result.count ? 200 : 404 },
  );
}

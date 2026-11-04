import { readJson } from "@/lib/http";
import { NextResponse } from "next/server";
import { currentAdmin, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { courseSchema } from "@/lib/course";
export async function GET() {
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json(
    await db.course.findMany({
      where: { adminId: admin.id },
      orderBy: { updatedAt: "desc" },
    }),
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await readJson(req);
  if (!body.ok) return body.response;
  const parsed = courseSchema.safeParse(body.data);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  return NextResponse.json(
    await db.course.create({
      data: { adminId: admin.id, title: parsed.data.title, data: parsed.data },
    }),
    { status: 201 },
  );
}

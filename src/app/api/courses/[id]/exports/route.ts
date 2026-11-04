import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { historySelect } from "@/lib/publishing/history";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await currentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  if (
    !(await db.course.findFirst({
      where: { id, adminId: admin.id },
      select: { id: true },
    }))
  )
    return NextResponse.json({ error: "Course unavailable" }, { status: 404 });
  const cursor = new URL(req.url).searchParams.get("cursor");
  if (
    cursor &&
    !(await db.publishedExport.findFirst({
      where: { id: cursor, courseId: id },
      select: { id: true },
    }))
  )
    return NextResponse.json(
      { error: "Invalid history cursor" },
      { status: 400 },
    );
  const records = await db.publishedExport.findMany({
    where: { courseId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: historySelect,
  });
  return NextResponse.json(
    {
      records: records.slice(0, 20),
      nextCursor: records.length > 20 ? records[19].id : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

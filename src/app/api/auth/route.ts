import { readJson } from "@/lib/http";
import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  currentAdmin,
  endSession,
  sameOrigin,
} from "@/lib/auth";
export async function GET() {
  const a = await currentAdmin();
  return NextResponse.json({ admin: a ? { email: a.email } : null });
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const body = await readJson(req, 16384);
  if (!body.ok) return body.response;
  const input = z
    .object({
      email: z.string().email().max(254),
      password: z.string().min(1).max(200),
    })
    .safeParse(body.data);
  if (!input.success)
    return NextResponse.json(
      { error: "Enter a valid email and password" },
      { status: 400 },
    );
  const key = input.data.email.toLowerCase();
  const now = new Date();
  const attempt = await db.loginAttempt.upsert({
    where: { key },
    create: { key, count: 1, resetAt: new Date(Date.now() + 900000) },
    update: { count: { increment: 1 } },
  });
  if (attempt.resetAt < now)
    await db.loginAttempt.update({
      where: { key },
      data: { count: 1, resetAt: new Date(Date.now() + 900000) },
    });
  else if (attempt.count > 10)
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  const admin = await db.admin.findUnique({ where: { email: key } });
  if (!admin || !(await compare(input.data.password, admin.passwordHash)))
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  await createSession(admin.id);
  await db.loginAttempt.deleteMany({ where: { key } });
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  await endSession();
  return NextResponse.json({ ok: true });
}

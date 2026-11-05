import { cookies } from "next/headers";
import { db } from "./db";
import { randomBytes, createHmac } from "node:crypto";
export async function currentAdmin() {
  const token = (await cookies()).get("elearning_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { admin: true },
  });
  return session && session.expiresAt > new Date() ? session.admin : null;
}
function hashToken(token: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(token).digest("hex");
}
export async function createSession(adminId: string) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: hashToken(token),
      adminId,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });
  (await cookies()).set("elearning_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get("elearning_session")?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete("elearning_session");
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected =
    process.env.APP_ORIGIN ||
    `${new URL(req.url).protocol}//${req.headers.get("host")}`;
  return (
    !!origin &&
    (origin === expected ||
      origin === "http://localhost:3000" ||
      origin === "http://localhost:3100" ||
      origin === "http://127.0.0.1:3000" ||
      origin === "http://127.0.0.1:3100")
  );
}

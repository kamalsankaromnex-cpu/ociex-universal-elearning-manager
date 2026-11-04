import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { demoCourse } from "../src/lib/course";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters)");
  const admin = await db.admin.upsert({
    where: { email },
    create: { email, passwordHash: await hash(password, 12) },
    update: {},
  });
  if (
    !(await db.course.findFirst({
      where: { adminId: admin.id, title: "Daimler EHS" },
    }))
  ) {
    const data = demoCourse();
    await db.course.create({
      data: { adminId: admin.id, title: data.title, data },
    });
  }
  console.log(
    "Administrator and demonstration course ready. Existing projects preserved.",
  );
}
main().finally(() => db.$disconnect());

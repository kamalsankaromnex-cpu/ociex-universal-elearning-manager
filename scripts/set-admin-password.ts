import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set ADMIN_EMAIL and a new ADMIN_PASSWORD of at least 12 characters in your local .env.",
    );
  await db.$transaction(async (tx) => {
    const admin = await tx.admin.update({
      where: { email },
      data: { passwordHash: await hash(password, 12) },
    });
    await tx.session.deleteMany({ where: { adminId: admin.id } });
  });
  console.log("Password updated and existing sessions revoked.");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

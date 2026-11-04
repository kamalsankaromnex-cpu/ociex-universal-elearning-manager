import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
test("edits during a save remain dirty; reload and sign-out warn", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your courses", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .first()
    .click();
  const title = `Persistence regression ${Date.now()}`;
  await page.getByLabel("Course name").fill(title);
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/courses") && r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  const record = await (await created).json();
  try {
    await page.getByLabel("Slide title", { exact: true }).fill("Submitted");
    let release!: () => void, signal!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      sent = new Promise<void>((r) => (signal = r));
    await page.route(`**/api/courses/${record.id}`, async (route) => {
      const response = await route.fetch();
      signal();
      await gate;
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Save changes" }).click();
    await sent;
    await page
      .getByLabel("Slide title", { exact: true })
      .fill("Newer unsaved edit");
    release();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeEnabled();
    await expect(
      page.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();
    await page.unroute(`**/api/courses/${record.id}`);
    const warning = page.waitForEvent("dialog");
    const signingOut = page
      .getByRole("button", { name: "Sign out" })
      .click({ noWaitAfter: true });
    const dialog = await warning;
    expect(dialog.message()).toContain("without saving");
    await dialog.dismiss();
    await signingOut;
    await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
      "Newer unsaved edit",
    );
    const reloadWarning = page.waitForEvent("dialog");
    const reload = page.reload({ timeout: 2000 }).catch(() => null);
    const unload = await reloadWarning;
    expect(unload.type()).toBe("beforeunload");
    await unload.dismiss();
    await reload;
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "All courses", exact: true })
      .click();
    await page
      .locator(".course-card")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .getByRole("button", { name: "Open course" })
      .click();
    await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
      "Newer unsaved edit",
    );
    await db.course.update({
      where: { id: record.id },
      data: { revision: { increment: 1 } },
    });
    await page
      .getByLabel("Slide title", { exact: true })
      .fill("Conflict must stay local");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Course changed or unavailable" }),
    ).toBeVisible();
    await expect(
      page.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();
    const stored = (
      await db.course.findUniqueOrThrow({ where: { id: record.id } })
    ).data as { levels: { slides: { title: string }[] }[] };
    expect(stored.levels[0].slides[0].title).toBe("Newer unsaved edit");
  } finally {
    await db.course.deleteMany({ where: { id: record.id } });
    await db.$disconnect();
  }
});

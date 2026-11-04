import { PrismaPg } from "@prisma/adapter-pg";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { newCourse } from "../src/lib/course";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const createdTitles = new Set<string>();
const email = process.env.ADMIN_EMAIL!,
  password = process.env.ADMIN_PASSWORD!;
async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.screenshot({
    path: "public/screenshots/login.png",
    fullPage: true,
  });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your courses", exact: true }),
  ).toBeVisible();
}
test.afterEach(async () => {
  await db.course.deleteMany({
    where: { admin: { email }, title: { in: [...createdTitles] } },
  });
  createdTitles.clear();
});
test.afterAll(async () => {
  await db.$disconnect();
});
test("save, reopen, customize, interact and delete a course", async ({
  page,
}) => {
  await login(page);
  await page.screenshot({
    path: "public/screenshots/dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .first()
    .click();
  const name = `Browser course ${Date.now()}`;
  createdTitles.add(name);
  await page.getByLabel("Course name").fill(name);
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .last()
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .getByLabel("Slide title", { exact: true })
    .fill("Saved interactive question");
  await page
    .getByLabel("Learning content")
    .fill("A persisted browser test question.");
  await page.getByLabel("Slide type").selectOption("single-choice");
  await page.getByRole("tab", { name: "Theme manager" }).click();
  await page.getByLabel("Primary", { exact: true }).fill("#7c3aed");
  await page.getByLabel("Course font").selectOption("Georgia");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "public/screenshots/theme-manager.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  await page
    .locator(".course-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "Open course" })
    .click();
  await page.getByRole("tab", { name: "Theme manager" }).click();
  await expect(page.getByLabel("Primary", { exact: true })).toHaveValue(
    "#7c3aed",
  );
  await expect(page.getByLabel("Course font")).toHaveValue("Georgia");
  await page.getByRole("tab", { name: "Content & slides" }).click();
  await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
    "Saved interactive question",
  );
  await page.screenshot({
    path: "public/screenshots/slide-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("life")).toHaveText("100%");
  await page.getByRole("radio", { name: /Demonstration option B/ }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("life")).toHaveText("75%");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("life")).toHaveText("75%");
  await page.screenshot({
    path: "public/screenshots/learner-preview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Restart preview" }).click();
  await expect(page.getByTestId("life")).toHaveText("100%");
  await page.getByRole("radio", { name: /Demonstration option A/ }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Correct answer", { exact: true })).toBeVisible();
  await expect(page.getByTestId("life")).toHaveText("100%");
  await page.getByRole("button", { name: "Back to editor" }).click();
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  const card = page
    .locator(".course-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await card.getByRole("button", { name: `Actions for ${name}` }).click();
  await card
    .getByRole("button", { name: "Delete course", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card).toHaveCount(0);
});
test("course ownership, authentication, CSRF and stale writes are enforced", async ({
  page,
}) => {
  expect((await page.request.get("/api/courses")).status()).toBe(401);
  await login(page);
  const other = await db.admin.upsert({
    where: { email: "isolation-test@example.com" },
    create: {
      email: "isolation-test@example.com",
      passwordHash: await hash("unused-local-test-password", 12),
    },
    update: {},
  });
  const data = newCourse("Isolated course");
  const c = await db.course.create({
    data: { title: data.title, data, adminId: other.id },
  });
  try {
    const listed = await page.request.get("/api/courses");
    expect(
      (await listed.json()).some((x: { id: string }) => x.id === c.id),
    ).toBe(false);
    expect(
      (
        await page.request.put(`/api/courses/${c.id}`, {
          headers: { origin: "http://localhost:3000" },
          data: { data, revision: 1 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.delete(`/api/courses/${c.id}`, {
          headers: { origin: "http://localhost:3000" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/courses", {
          headers: { origin: "https://untrusted.example" },
          data,
        })
      ).status(),
    ).toBe(403);
    const own = await page.request.post("/api/courses", {
      headers: { origin: "http://localhost:3000" },
      data,
    });
    expect(own.status()).toBe(201);
    const record = await own.json();
    try {
      expect(
        (
          await page.request.put(`/api/courses/${record.id}`, {
            headers: { origin: "http://localhost:3000" },
            data: { data, revision: 1 },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await page.request.put(`/api/courses/${record.id}`, {
            headers: { origin: "http://localhost:3000" },
            data: { data, revision: 1 },
          })
        ).status(),
      ).toBe(409);
    } finally {
      await db.course.delete({ where: { id: record.id } });
    }
  } finally {
    await db.course.delete({ where: { id: c.id } });
    await db.admin.delete({ where: { id: other.id } });
  }
});
test("mobile navigation works and course layout fits the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Getting started" }).last().click();
  await expect(
    page.getByRole("heading", { name: "From an idea to an experience" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go to your courses" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "public/screenshots/mobile-dashboard.png",
    fullPage: true,
  });
});

test("level ordering, slide changes and unsaved preview round trip", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .first()
    .click();
  const name = `Structure test ${Date.now()}`;
  createdTitles.add(name);
  await page.getByLabel("Course name").fill(name);
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .last()
    .click();
  await page
    .getByLabel("Slide title", { exact: true })
    .fill("Unsaved title survives preview");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Unsaved title survives preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to editor" }).click();
  await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
    "Unsaved title survives preview",
  );
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate slide", exact: true })
    .click();
  await page.getByLabel("Slide title", { exact: true }).fill("Second slide");
  await page
    .getByRole("button", { name: "Move slide up", exact: true })
    .click();
  await expect(page.locator(".slide-card strong").first()).toHaveText(
    "Second slide",
  );
  await page.getByRole("button", { name: "Add level", exact: true }).click();
  await page.getByLabel("Level title", { exact: true }).fill("New first level");
  await page
    .getByRole("button", { name: "Move level up", exact: true })
    .click();
  await expect(page.locator(".level-card strong").first()).toHaveText(
    "New first level",
  );
  await page
    .getByRole("button", { name: "Add slide", exact: true })
    .first()
    .click();
  await page.getByLabel("Slide title", { exact: true }).fill("New first slide");
  await page.getByLabel("Upload slide image").setInputFiles({
    name: "example.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHyQAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".media-thumb img")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  await page.getByRole("tab", { name: "Course header" }).click();
  await page
    .getByLabel("Header title", { exact: true })
    .fill("Configured course header");
  await page.getByLabel("Show course logo").uncheck();
  await page.screenshot({
    path: "public/screenshots/course-header.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".learner-header")).toContainText(
    "Configured course header",
  );
  await expect(
    page.locator(".learner-header > div:first-child > svg"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Back to editor" }).click();

  await page.getByRole("tab", { name: "Course settings" }).click();
  const renamed = `${name} renamed`;
  createdTitles.add(renamed);
  await page.getByLabel("Course title", { exact: true }).fill(renamed);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  const card = page
    .locator(".course-card")
    .filter({ has: page.getByRole("heading", { name: renamed, exact: true }) });
  await card.getByRole("button", { name: "Open course" }).click();
  await expect(page.locator(".level-card strong").first()).toHaveText(
    "New first level",
  );
  await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
    "New first slide",
  );
  await expect(page.locator(".media-thumb img")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  await page.getByRole("button", { name: "Delete level", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".level-card")).toHaveCount(2);
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  await card.getByRole("button", { name: `Actions for ${renamed}` }).click();
  await card
    .getByRole("button", { name: "Delete course", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card).toHaveCount(0);
});

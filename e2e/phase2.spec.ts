import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { newCourse } from "../src/lib/course";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const origin = { origin: "http://localhost:3000" };
const fixtureCourses = new Set<string>();
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your courses", exact: true }),
  ).toBeVisible();
}
async function create(page: Page, name: string) {
  const r = await page.request.post("/api/courses", {
    headers: origin,
    data: newCourse(name),
  });
  expect(r.status()).toBe(201);
  const record = await r.json();
  fixtureCourses.add(record.id);
  return record;
}
async function open(page: Page, name: string) {
  await page.reload();
  await page
    .locator(".course-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "Open course" })
    .click();
}
test.afterEach(async () => {
  await db.course.deleteMany({ where: { id: { in: [...fixtureCourses] } } });
  fixtureCourses.clear();
});
test.afterAll(async () => {
  await db.$disconnect();
});
test("immutable history downloads survive edits and acceptance records are tied to the exact ZIP", async ({
  page,
}) => {
  await login(page);
  const name = `Phase2 archive ${Date.now()}`;
  const record = await create(page, name);
  try {
    await open(page, name);
    await page
      .getByRole("tab", { name: "Course settings", exact: true })
      .click();
    await page.getByLabel("Passing score (%)", { exact: true }).fill("70");
    await page.getByLabel("Optional-question scoring").selectOption("exclude");
    await page
      .getByLabel("Unanswered-question scoring")
      .selectOption("exclude-optional");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Publishing", exact: true }).click();
    await page.getByLabel("SCORM version").selectOption("2004");
    await page.getByLabel("Export scope").selectOption("course");
    await page.getByRole("button", { name: "Validate saved revision" }).click();
    await expect(
      page.getByText("Validation passed", { exact: true }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export ZIP", exact: true }).click();
    const zip = await readFile((await (await download).path())!);
    const hash = createHash("sha256").update(zip).digest("hex");
    const metadata = JSON.parse(
      strFromU8(unzipSync(zip)["export-metadata.json"]),
    );
    expect(metadata.scoringPolicy).toMatchObject({
      passingScore: 70,
      optional: "exclude",
      unanswered: "exclude-optional",
    });
    const history = page.getByRole("region", { name: "Export history" });
    await expect(
      history.getByText("Revision 2", { exact: true }),
    ).toBeVisible();
    let records = (
      await (await page.request.get(`/api/courses/${record.id}/exports`)).json()
    ).records;
    const artifact = records[0];
    expect(artifact.sha256).toBe(hash);
    expect(artifact.zip).toBeUndefined();
    expect(artifact.snapshot).toBeUndefined();
    await page
      .getByRole("tab", { name: "Content & slides", exact: true })
      .click();
    await page
      .getByLabel("Slide title", { exact: true })
      .fill("Later revision");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Publishing", exact: true }).click();
    const archived = await page.request.get(
      `/api/courses/${record.id}/exports/${artifact.id}/download`,
    );
    expect(archived.status()).toBe(200);
    expect(
      createHash("sha256")
        .update(await archived.body())
        .digest("hex"),
    ).toBe(hash);
    await history.getByRole("button", { name: "Record LMS test" }).click();
    await page
      .getByLabel("LMS version / build tested")
      .fill("Browser regression simulation — not external LMS verification");
    await page
      .getByLabel("Tester", { exact: true })
      .fill("Automated browser fixture");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Test result").selectOption("passed");
    await page
      .getByLabel("Evidence and observations")
      .fill(
        "Fixture record for form validation; no real external LMS was tested.",
      );
    await page.screenshot({
      path: "docs/phase2/screenshots/acceptance-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save acceptance record" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "requires actual import",
    );
    await page.getByLabel("Test result").selectOption("unverified");
    await page.getByRole("button", { name: "Save acceptance record" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await history
      .locator("summary")
      .filter({ hasText: "LMS acceptance records" })
      .click();
    await expect(
      history.getByText("SCORM Cloud · SCORM 2004 · unverified", {
        exact: true,
      }),
    ).toBeVisible();
    records = (
      await (await page.request.get(`/api/courses/${record.id}/exports`)).json()
    ).records;
    expect(records[0].acceptances[0].result).toBe("unverified");
    expect(
      await db.publishedExport.updateMany({
        where: { id: artifact.id },
        data: { revision: 99 },
      }),
    ).toMatchObject({ count: 0 });
    expect(
      (
        await db.publishedExport.findUniqueOrThrow({
          where: { id: artifact.id },
        })
      ).revision,
    ).toBe(2);
    expect(
      await db.lmsAcceptance.updateMany({
        where: { id: records[0].acceptances[0].id },
        data: { result: "failed" },
      }),
    ).toMatchObject({ count: 0 });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "docs/phase2/screenshots/publishing-history.png",
      fullPage: true,
    });
  } finally {
    await db.course.deleteMany({ where: { id: record.id } });
  }
});
test("publishing endpoints enforce ownership, origins, edition matching and failure history", async ({
  page,
  playwright,
}) => {
  await login(page);
  const record = await create(page, `Phase2 isolation ${Date.now()}`);
  const password = randomUUID();
  const other = await db.admin.create({
    data: {
      email: `phase2-${randomUUID()}@example.test`,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  const outsider = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  try {
    const publish = await page.request.post(
      `/api/courses/${record.id}/export`,
      {
        headers: origin,
        data: { revision: 1, version: "1.2", scope: "course" },
      },
    );
    expect(publish.status()).toBe(200);
    const artifact = publish.headers()["x-export-id"];
    expect(artifact).toBeTruthy();
    expect(
      (await outsider.get(`/api/courses/${record.id}/exports`)).status(),
    ).toBe(401);
    expect(
      (
        await outsider.post("/api/auth", {
          headers: origin,
          data: { email: other.email, password },
        })
      ).status(),
    ).toBe(200);
    for (const path of [
      `/api/courses/${record.id}`,
      `/api/courses/${record.id}/exports`,
      `/api/courses/${record.id}/exports/${artifact}/download`,
    ])
      expect((await outsider.get(path)).status()).toBe(404);
    const body = {
      platform: "Fixture",
      edition: "2004",
      testedVersion: "Fixture",
      tester: "Fixture",
      testedAt: new Date().toISOString(),
      result: "unverified",
      evidence: "Unverified fixture",
      importVerified: false,
      launchVerified: false,
      debugVerified: false,
    };
    expect(
      (
        await outsider.post(
          `/api/courses/${record.id}/exports/${artifact}/acceptance`,
          { headers: origin, data: body },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(
          `/api/courses/${record.id}/exports/${artifact}/acceptance`,
          { headers: { origin: "https://invalid.test" }, data: body },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(
          `/api/courses/${record.id}/exports/${artifact}/acceptance`,
          { headers: origin, data: body },
        )
      ).status(),
    ).toBe(400);
    const bad = newCourse("Bad assets");
    bad.levels[0].slides[0].image = `assets/media/${"a".repeat(64)}.png`;
    await db.course.update({
      where: { id: record.id },
      data: { data: bad, revision: 2 },
    });
    expect(
      (
        await page.request.post(`/api/courses/${record.id}/export`, {
          headers: origin,
          data: { revision: 2, version: "2004", scope: "course" },
        })
      ).status(),
    ).toBe(422);
    const history = (
      await (await page.request.get(`/api/courses/${record.id}/exports`)).json()
    ).records;
    expect(
      history.some(
        (r: { status: string; revision: number }) =>
          r.status === "failed" && r.revision === 2,
      ),
    ).toBe(true);
    expect(
      (
        await page.request.get(
          `/api/courses/${record.id}/exports/${history.find((r: { status: string }) => r.status === "failed").id}/download`,
        )
      ).status(),
    ).toBe(404);
  } finally {
    await outsider.dispose();
    await db.course.deleteMany({ where: { id: record.id } });
    await db.admin.delete({ where: { id: other.id } });
  }
});
test("forced reload recovers drafts, failed save retry retries PUT, and all tab panels are linked", async ({
  page,
}) => {
  let listRequests = 0;
  await page.route("**/api/courses", async (route) => {
    if (route.request().method() === "GET" && ++listRequests === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary library failure" }),
      });
    else await route.continue();
  });
  await login(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "Temporary library failure" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect.poll(() => listRequests).toBe(2);
  await page.unroute("**/api/courses");
  const name = `Phase2 recovery ${Date.now()}`;
  const record = await create(page, name);
  try {
    await open(page, name);
    await page
      .getByLabel("Slide title", { exact: true })
      .fill("Recover after reload");
    await expect
      .poll(() =>
        page.evaluate(
          (id) => sessionStorage.getItem(`course-draft:${id}`),
          record.id,
        ),
      )
      .toContain("Recover after reload");
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page
      .locator(".course-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "Open course" })
      .click();
    await page
      .getByRole("button", { name: "Restore draft", exact: true })
      .click();
    await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
      "Recover after reload",
    );
    let puts = 0;
    await page.route(`**/api/courses/${record.id}`, async (route) => {
      if (route.request().method() === "PUT" && ++puts === 1)
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Temporary save failure" }),
        });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("region", { name: "Save error" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
    expect(puts).toBe(2);
    await page.unroute(`**/api/courses/${record.id}`);
    for (const name of [
      "Theme manager",
      "Course header",
      "Publishing",
      "Course settings",
      "Content & slides",
    ]) {
      const tab = page.getByRole("tab", { name, exact: true });
      await tab.click();
      const id = await tab.getAttribute("aria-controls");
      const panel = page.locator(`[id="${id}"]`);
      await expect(panel).toBeVisible();
      expect(await panel.getAttribute("aria-labelledby")).toBe(
        await tab.getAttribute("id"),
      );
      await expect(panel).not.toBeEmpty();
    }
    const theme = page.getByRole("tab", { name: "Theme manager", exact: true });
    await theme.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Course header", exact: true }),
    ).toBeFocused();
  } finally {
    await db.course.deleteMany({ where: { id: record.id } });
  }
});

test("stale recovery cannot overwrite a newer revision and conflict reopening is explicit", async ({
  page,
}) => {
  await login(page);
  const name = `Phase2 stale draft ${Date.now()}`;
  const record = await create(page, name);
  try {
    await open(page, name);
    await page
      .getByLabel("Slide title", { exact: true })
      .fill("Older unsaved draft");
    await expect
      .poll(() =>
        page.evaluate(
          (id) => sessionStorage.getItem(`course-draft:${id}`),
          record.id,
        ),
      )
      .toContain("Older unsaved draft");
    const updated = newCourse(name);
    updated.levels = record.data.levels;
    updated.levels[0].slides[0].title = "Other editor's work";
    await db.course.update({
      where: { id: record.id },
      data: { data: updated, revision: 2 },
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page
      .locator(".course-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "Open course" })
      .click();
    await expect(
      page.getByRole("button", { name: "Restore draft", exact: true }),
    ).toBeDisabled();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download draft JSON", exact: true })
      .click();
    const draft = JSON.parse(
      (await readFile((await (await download).path())!)).toString(),
    );
    expect(draft.data.levels[0].slides[0].title).toBe("Older unsaved draft");
    await page.getByRole("button", { name: "Discard recovered draft" }).click();
    await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
      "Other editor's work",
    );
    await page
      .getByLabel("Slide title", { exact: true })
      .fill("Conflict draft");
    await db.course.update({ where: { id: record.id }, data: { revision: 3 } });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("region", { name: "Save error" }),
    ).toContainText("Course changed or unavailable");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Reopen latest saved revision" })
      .click();
    await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
      "Other editor's work",
    );
    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
  } finally {
    await db.course.deleteMany({ where: { id: record.id } });
  }
});

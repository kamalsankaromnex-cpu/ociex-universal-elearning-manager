// Independent acceptance walkthrough; run against a development/test database only.
// node --env-file=.env docs/phase1-review/run-review.mjs
import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.REVIEW_BASE_URL || "http://localhost:3000";
const origin = new URL(base).origin;
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
});
const admin = await db.admin.findUniqueOrThrow({
  where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
});
const original = await db.course.findMany({
  where: { adminId: admin.id },
  select: { id: true, data: true, revision: true },
});
const fingerprint = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
const originalHash = fingerprint(original);
const ids = [];
let otherAdmin;
const contexts = [];
const evidence = {
  date: "2026-11-04",
  target: "production build",
  passed: [],
  findings: [],
  ui: [],
  security: {},
  cleanup: {},
};
const out = "docs/phase1-review";
await mkdir(`${out}/screenshots`, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
contexts.push(context);
const page = await context.newPage();
async function shot(name) {
  await page.screenshot({
    path: `${out}/screenshots/${name}.png`,
    fullPage: true,
  });
}
async function login(
  p,
  email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD,
) {
  await p.goto(base);
  await p.getByLabel("Email address").fill(email);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    p.getByRole("heading", { name: "Your courses", exact: true }),
  ).toBeVisible();
}
async function newProject(title) {
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .first()
    .click();
  await page.getByLabel("Course name").fill(title);
  const response = page.waitForResponse(
    (r) =>
      r.url() === `${origin}/api/courses` && r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  const record = await (await response).json();
  ids.push(record.id);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  return record;
}
async function open(title) {
  await page
    .locator(".course-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "Open course" })
    .click();
  await page.getByLabel("Slide title", { exact: true }).waitFor();
}
async function save() {
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
}
async function colors(screen) {
  const result = await page.evaluate(() => {
    const r = getComputedStyle(document.documentElement),
      b = document.querySelector(".btn-primary"),
      card = document.querySelector(
        ".property-panel,.stat-card,.slide-edit-surface",
      );
    return {
      primaryToken: r.getPropertyValue("--primary").trim(),
      backgroundToken: r.getPropertyValue("--background").trim(),
      button: b ? getComputedStyle(b).backgroundColor : null,
      surface: card ? getComputedStyle(card).backgroundColor : null,
      icons: document.querySelectorAll("svg.lucide").length,
    };
  });
  evidence.ui.push({ screen, ...result });
}
try {
  await page.goto(base);
  await page.getByLabel("Email address").waitFor();
  await shot("01-login");
  await login(page);
  await page.locator(".course-card").first().waitFor();
  await colors("dashboard");
  await shot("02-dashboard");
  const cookies = await context.cookies();
  evidence.security.sessionCookie = cookies
    .filter((c) => c.name === "elearning_session")
    .map((c) => ({
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));
  const secretValues = ["SESSION_SECRET", "ADMIN_PASSWORD", "DATABASE_URL"]
    .map((k) => process.env[k])
    .filter(Boolean);
  const bodies = [];
  page.on("response", async (r) => {
    if (r.url().startsWith(origin + "/api/"))
      try {
        bodies.push(await r.text());
      } catch {}
  });
  for (const path of [
    "/.env",
    "/.env.local",
    "/test-results/trace.zip",
    "/prisma/schema.prisma",
  ]) {
    const r = await context.request.get(`${origin}${path}`);
    evidence.security[path] = r.status();
    expect(r.status()).toBe(404);
  }
  const a = await newProject(`Acceptance A ${Date.now()}`);
  await page
    .getByLabel("Slide title", { exact: true })
    .fill("Reviewed single-choice question");
  await page
    .getByLabel("Learning content")
    .fill("Review demonstration: select option A.");
  await page.getByLabel("Slide type").selectOption("single-choice");
  await page.getByLabel("Slide background override").fill("#fef3c7");
  await colors("slide-editor");
  await shot("03-slide-editor");
  await page.getByRole("tab", { name: "Theme manager" }).click();
  await page.getByLabel("Primary", { exact: true }).fill("#7c3aed");
  await page.getByLabel("Course font").selectOption("Georgia");
  await page.getByLabel("Body size (14–24px)").fill("20");
  await colors("theme-manager");
  await shot("04-theme-manager");
  const tabA11y = await page
    .getByRole("tab", { name: "Theme manager" })
    .evaluate((el) => ({
      controls: el.getAttribute("aria-controls"),
      hasPanel: !!document.getElementById(el.getAttribute("aria-controls")),
    }));
  evidence.findings.push({
    id: "F04",
    name: "Tab triggers reference missing tab panels",
    observed: !tabA11y.hasPanel,
    ...tabA11y,
  });
  await page.getByRole("tab", { name: "Course header" }).click();
  await page
    .getByLabel("Header title", { exact: true })
    .fill("Acceptance course A");
  await colors("header");
  await shot("05-header");
  await save();
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  await open(a.title);
  await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
    "Reviewed single-choice question",
  );
  await page.getByRole("tab", { name: "Theme manager" }).click();
  await expect(page.getByLabel("Primary", { exact: true })).toHaveValue(
    "#7c3aed",
  );
  await expect(page.getByLabel("Course font")).toHaveValue("Georgia");
  evidence.passed.push(
    "Create/edit/save/reopen preserves slide, theme and font in PostgreSQL",
  );
  const beforePreview = await db.course.findUniqueOrThrow({
    where: { id: a.id },
  });
  let previewWrites = 0;
  const watch = (req) => {
    if (
      req.url().startsWith(origin + "/api/") &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(req.method())
    )
      previewWrites++;
  };
  page.on("request", watch);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("life")).toHaveText("100%");
  await page.getByRole("radio", { name: /Demonstration option B/ }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("life")).toHaveText("75%");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("life")).toHaveText("75%");
  const learner = await page
    .locator(".lesson")
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      font: getComputedStyle(el).fontFamily,
      bodySize: getComputedStyle(el.querySelector("p")).fontSize,
      button: getComputedStyle(document.querySelector(".learner-primary"))
        .backgroundColor,
    }));
  expect(learner.background).toBe("rgb(254, 243, 199)");
  expect(learner.button).toBe("rgb(124, 58, 237)");
  expect(learner.font).toContain("Georgia");
  expect(learner.bodySize).toBe("20px");
  await shot("06-learner-75-percent");
  await page.getByRole("button", { name: "Back to editor" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("life")).toHaveText("100%");
  await page.getByRole("button", { name: "Back to editor" }).click();
  page.off("request", watch);
  const afterPreview = await db.course.findUniqueOrThrow({
    where: { id: a.id },
  });
  expect(fingerprint(afterPreview)).toBe(fingerprint(beforePreview));
  expect(previewWrites).toBe(0);
  evidence.passed.push(
    "Preview: 100→75 once, close/reopen resets to100, no API writes or database changes; slide override and learner colors/fonts isolated from admin",
  );
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  const b = await newProject(`Acceptance B ${Date.now()}`);
  const bBefore = await db.course.findUniqueOrThrow({ where: { id: b.id } });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("life")).toHaveText("100%");
  await page.getByRole("button", { name: "Back to editor" }).click();
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  await open(a.title);
  await page
    .getByLabel("Slide title", { exact: true })
    .fill("Snapshot submitted to server");
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let signal;
  const sent = new Promise((resolve) => (signal = resolve));
  await page.route(`**/api/courses/${a.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const r = await route.fetch();
    signal();
    await gate;
    await route.fulfill({ response: r });
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await sent;
  const later = "Edit made while save response is pending";
  await page.getByLabel("Slide title", { exact: true }).fill(later);
  release();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.unroute(`**/api/courses/${a.id}`);
  const aStored = await db.course.findUniqueOrThrow({ where: { id: a.id } });
  const storedTitle = aStored.data.levels[0].slides[0].title;
  evidence.findings.push({
    id: "F01",
    name: "Save response clears dirty state for later edits",
    observed: storedTitle !== later,
    ui: later,
    stored: storedTitle,
    status: "All changes saved",
  });
  await shot("07-save-race-false-saved");
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  await open(a.title);
  await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
    storedTitle,
  );
  expect(
    fingerprint(await db.course.findUniqueOrThrow({ where: { id: b.id } })),
  ).toBe(fingerprint(bBefore));
  evidence.passed.push("Editing A leaves B unchanged; B preview starts at100");
  await page
    .getByLabel("Slide title", { exact: true })
    .fill("Unsaved edit before reload");
  let dialogs = 0;
  const countDialog = async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  };
  page.on("dialog", countDialog);
  await page.reload();
  await page
    .getByRole("heading", { name: "Your courses", exact: true })
    .waitFor();
  await open(a.title);
  await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
    storedTitle,
  );
  page.off("dialog", countDialog);
  evidence.findings.push({
    id: "F02",
    name: "Page reload discards dirty content without warning",
    observed: dialogs === 0,
  });
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  let listRequests = 0;
  await page.route("**/api/courses", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    listRequests++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Review-injected temporary list failure" }),
    });
  });
  await page.getByRole("button", { name: "Theme library" }).first().click();
  await page.getByRole("button", { name: "Course dashboard" }).first().click();
  // Navigating alone does not fetch. Reopen/back invokes the listing operation.
  await open(a.title);
  await page.getByRole("button", { name: "All courses", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Review-injected" }),
  ).toContainText("Review-injected");
  const beforeRetry = listRequests;
  await shot("08-list-error");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  evidence.findings.push({
    id: "F03",
    name: "Try again only dismisses the list error",
    observed: listRequests === beforeRetry,
    listRequestsBefore: beforeRetry,
    listRequestsAfter: listRequests,
  });
  await page.unroute("**/api/courses");
  otherAdmin = await db.admin.create({
    data: {
      email: `review-${randomBytes(6).toString("hex")}@example.invalid`,
      passwordHash: await hash(
        "Review-only-" + randomBytes(20).toString("hex"),
        12,
      ),
    },
  });
  // Use a fresh generated password only for this temporary principal.
  const otherPassword = randomBytes(24).toString("hex");
  await db.admin.update({
    where: { id: otherAdmin.id },
    data: { passwordHash: await hash(otherPassword, 12) },
  });
  const otherContext = await browser.newContext();
  contexts.push(otherContext);
  const otherPage = await otherContext.newPage();
  await login(otherPage, otherAdmin.email, otherPassword);
  const otherList = await (
    await otherContext.request.get(`${origin}/api/courses`)
  ).json();
  expect(otherList).toEqual([]);
  const foreignPut = await otherContext.request.put(
    `${origin}/api/courses/${a.id}`,
    {
      headers: { origin },
      data: { data: aStored.data, revision: aStored.revision },
    },
  );
  expect(foreignPut.status()).toBe(409);
  const foreignDelete = await otherContext.request.delete(
    `${origin}/api/courses/${a.id}`,
    { headers: { origin } },
  );
  expect(foreignDelete.status()).toBe(404);
  const unauth = await browser.newContext();
  contexts.push(unauth);
  expect((await unauth.request.get(`${origin}/api/courses`)).status()).toBe(
    401,
  );
  evidence.security.isolation = {
    foreignListCount: otherList.length,
    foreignUpdateStatus: foreignPut.status(),
    foreignDeleteStatus: foreignDelete.status(),
    anonymousListStatus: 401,
  };
  evidence.passed.push(
    "Separate administrator cannot list, update or delete another administrator’s courses",
  );
  await page.getByRole("button", { name: "Theme library" }).first().click();
  await colors("theme-library");
  await shot("09-theme-library");
  await page.getByRole("button", { name: "Getting started" }).first().click();
  await colors("guide");
  await shot("10-guide");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Course dashboard" })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await shot("11-mobile");
  await page.setViewportSize({ width: 1024, height: 900 });
  await shot("12-tablet");
  await page.getByRole("button", { name: "Sign out" }).click();
  expect((await context.request.get(`${origin}/api/courses`)).status()).toBe(
    401,
  );
  evidence.security.responseContainsCredentialValue = bodies.some((body) =>
    secretValues.some((s) => body.includes(s)),
  );
  expect(evidence.security.responseContainsCredentialValue).toBe(false);
  evidence.passed.push(
    "Desktop/tablet/mobile layout and drawer navigation checked; logout revokes session; API responses do not contain configured credential values",
  );
} finally {
  await db.course.deleteMany({ where: { id: { in: ids }, adminId: admin.id } });
  if (otherAdmin) await db.admin.delete({ where: { id: otherAdmin.id } });
  for (const c of contexts) {
    await c.request.delete(`${origin}/api/auth`, { headers: { origin } });
    await c.close();
  }
  evidence.cleanup.temporaryCoursesRemaining = await db.course.count({
    where: { id: { in: ids } },
  });
  evidence.cleanup.originalCoursesUnchanged =
    fingerprint(
      await db.course.findMany({
        where: { adminId: admin.id },
        select: { id: true, data: true, revision: true },
      }),
    ) === originalHash;
  await writeFile(
    `${out}/evidence.json`,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
  await db.$disconnect();
}
console.log(JSON.stringify(evidence, null, 2));

import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createServer, type Server } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import { newCourse } from "../src/lib/course";
import { installMockLms } from "./fixtures/lms";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const created = new Set<string>();
let server: Server;
const packages = new Map<string, Record<string, Uint8Array>>();
test.beforeAll(async () => {
  await mkdir("docs/phase3-1/screenshots", { recursive: true });
  for (const version of ["1.2", "2004"] as const)
    packages.set(
      version,
      unzipSync(
        await readFile(
          `deliverables/multi-select/Machine-Guarding-Multi-Select-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}.zip`,
        ),
      ),
    );
  server = createServer((req, res) => {
    const [version, ...parts] = (req.url ?? "")
      .split("?")[0]
      .slice(1)
      .split("/");
    const path = parts.join("/");
    const bytes = packages.get(version)?.[path];
    if (!bytes) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      path.endsWith(".js")
        ? "application/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : path.endsWith(".html")
            ? "text/html"
            : path.endsWith(".woff2")
              ? "font/woff2"
              : "application/octet-stream",
    );
    res.end(bytes);
  });
  await new Promise<void>((resolve) =>
    server.listen(4175, "127.0.0.1", resolve),
  );
});
test.afterEach(async () => {
  await db.course.deleteMany({ where: { id: { in: [...created] } } });
  created.clear();
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});
async function login(page: Page) {
  await page.goto("/");
  const emailInput = page.getByLabel("Email address");
  const coursesHeading = page.getByRole("heading", {
    name: "Your courses",
    exact: true,
  });
  await expect(emailInput.or(coursesHeading)).toBeVisible();
  if (await coursesHeading.isVisible()) return;
  await page.getByLabel("Email address").fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your courses", exact: true }),
  ).toBeVisible();
}
async function create(page: Page, title: string) {
  const response = await page.request.post("/api/courses", {
    headers: { origin: process.env.APP_ORIGIN || "http://localhost:3100" },
    data: newCourse(title),
  });
  expect(response.status()).toBe(201);
  const record = await response.json();
  created.add(record.id);
  await page.reload();
  await open(page, title);
  return record;
}
async function open(page: Page, title: string) {
  await page
    .locator(".course-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "Open course" })
    .click();
}
test("authoring saves/reopens options, correct IDs, scoring, feedback and images; preview uses accessible checkbox submissions", async ({
  page,
}) => {
  await login(page);
  const title = `Multi-select authoring ${Date.now()}`;
  const record = await create(page, title);
  await page.getByLabel("Slide type").selectOption("multi-select");
  await page
    .getByLabel("Slide title", { exact: true })
    .fill("Guarding controls");
  await page.getByLabel("Option A", { exact: true }).fill("Fixed barrier");
  await page.getByLabel("Option B", { exact: true }).fill("Interlocked gate");
  await page.getByLabel("Option B is correct", { exact: true }).check();
  await page
    .getByRole("button", { name: "Add answer option", exact: true })
    .click();
  await page.getByLabel("Option C", { exact: true }).fill("Paint color");
  await page
    .getByRole("button", { name: "Add answer option", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove option D", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move option C up", exact: true })
    .click();
  await expect(page.getByLabel("Option C", { exact: true })).toHaveValue(
    "Interlocked gate",
  );
  await expect(
    page.getByLabel("Option C is correct", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("Multi-select scoring").selectOption("partial-credit");
  await page
    .getByLabel("Partial-credit feedback", { exact: true })
    .fill("Review the second control.");
  await page
    .getByLabel("Correct feedback", { exact: true })
    .fill("Both guarding controls selected.");
  await page
    .getByLabel("Upload option a image", { exact: true })
    .setInputFiles({
      name: "barrier.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHyQAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page
    .getByLabel("Option A image alternative text", { exact: true })
    .fill("Illustrative barrier");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await open(page, title);
  await expect(page.getByLabel("Multi-select scoring")).toHaveValue(
    "partial-credit",
  );
  await expect(page.getByLabel("Partial-credit feedback")).toHaveValue(
    "Review the second control.",
  );
  await expect(
    page.getByLabel("Option C is correct", { exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Option A image alternative text")).toHaveValue(
    "Illustrative barrier",
  );
  const before = await db.course.findUniqueOrThrow({
    where: { id: record.id },
  });
  await page.screenshot({
    path: "docs/phase3-1/screenshots/multi-select-authoring.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const learner = page.locator(".learner");
  const group = learner.getByRole("group", {
    name: "Choose one or more answers",
    exact: true,
  });
  await expect(group).toBeVisible();
  expect(await group.getAttribute("aria-describedby")).toBeTruthy();
  await expect(
    learner.getByRole("button", { name: "Submit answer", exact: true }),
  ).toBeDisabled();
  const first = group.getByRole("checkbox", { name: /Fixed barrier/ });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await learner
    .getByRole("button", { name: "Submit answer", exact: true })
    .dblclick();
  await expect(learner.getByTestId("life")).toHaveText("75%");
  await expect(learner.getByTestId("multi-submission-credit")).toHaveText(
    "50%",
  );
  await expect(learner.getByRole("status")).toContainText(
    "Review the second control.",
  );
  await expect(
    learner.getByRole("img", { name: "Illustrative barrier", exact: true }),
  ).toBeVisible();
  await learner
    .getByRole("button", { name: "Restart preview", exact: true })
    .click();
  await expect(first).not.toBeChecked();
  await expect(
    learner.getByRole("button", { name: "Submit answer", exact: true }),
  ).toBeDisabled();
  await expect(learner.getByTestId("life")).toHaveText("100%");
  await expect(learner.getByTestId("multi-best-credit")).toHaveCount(0);
  await first.focus();
  await page.keyboard.press("Space");
  await learner
    .getByRole("button", { name: "Submit answer", exact: true })
    .dblclick();
  await expect(learner.getByTestId("life")).toHaveText("75%");
  await group.getByRole("checkbox", { name: /Paint color/ }).check();
  await learner
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await expect(learner.getByTestId("multi-submission-credit")).toHaveText("0%");
  await expect(learner.getByTestId("multi-best-credit")).toHaveText("50%");
  await expect(learner.getByTestId("life")).toHaveText("75%");
  await group.getByRole("checkbox", { name: /Paint color/ }).uncheck();
  const second = group.getByRole("checkbox", { name: /Interlocked gate/ });
  await second.focus();
  await page.keyboard.press("Space");
  await learner
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await expect(learner.getByTestId("multi-submission-credit")).toHaveText(
    "100%",
  );
  await expect(learner.getByRole("status")).toContainText(
    "Both guarding controls selected.",
  );
  await page.screenshot({
    path: "docs/phase3-1/screenshots/multi-select-preview.png",
    fullPage: true,
  });
  await learner
    .getByRole("button", { name: "Back to editor", exact: true })
    .click();
  expect(
    (await db.course.findUniqueOrThrow({ where: { id: record.id } })).data,
  ).toEqual(before.data);
  await page.getByLabel("Multi-select scoring").selectOption("all-or-nothing");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await learner.getByRole("checkbox", { name: /Fixed barrier/ }).check();
  await learner
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await expect(learner.getByTestId("multi-submission-credit")).toHaveText("0%");
  await expect(
    learner.getByRole("button", { name: "Finish learning", exact: true }),
  ).toBeDisabled();
  await learner
    .getByRole("button", { name: "Back to editor", exact: true })
    .click();
  await page
    .getByLabel("Incorrect-answer life penalty (%)", { exact: true })
    .fill("100");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await learner.getByRole("checkbox", { name: /Fixed barrier/ }).check();
  await learner
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await expect(learner.getByTestId("life")).toHaveText("0%");
  await learner
    .getByRole("button", { name: "Retry current level", exact: true })
    .click();
  await expect(learner.getByTestId("life")).toHaveText("100%");
  await expect(
    learner.getByRole("checkbox", { name: /Fixed barrier/ }),
  ).not.toBeChecked();
  await expect(
    learner.getByRole("button", { name: "Submit answer", exact: true }),
  ).toBeDisabled();
  await expect(learner.getByTestId("multi-best-credit")).toHaveCount(0);
  await learner
    .getByRole("button", { name: "Back to editor", exact: true })
    .click();
  await page.getByLabel("Slide type").selectOption("single-choice");
  await page
    .getByRole("button", { name: "Remove option C", exact: true })
    .click();
  await page.getByLabel("Slide type").selectOption("multi-select");
  await expect(
    page.getByLabel("Option A is correct", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Option B is correct", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await learner.getByRole("checkbox", { name: /Fixed barrier/ }).check();
  await learner
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await expect(learner.getByTestId("multi-submission-credit")).toHaveText(
    "100%",
  );
});
test("machine-guarding sample adds an editable demonstration without replacing course content", async ({
  page,
}) => {
  await login(page);
  const record = await create(page, `Machine-guarding sample ${Date.now()}`);
  await page
    .getByRole("button", { name: "Add machine-guarding sample", exact: true })
    .click();
  await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
    "Machine guarding — demonstration",
  );
  await expect(page.getByLabel("Slide type")).toHaveValue("multi-select");
  await expect(page.getByLabel("Option A is correct")).toBeChecked();
  await expect(page.getByLabel("Option B is correct")).toBeChecked();
  expect(await page.getByLabel("Learning content").inputValue()).toContain(
    "Demonstration",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  const saved = await db.course.findUniqueOrThrow({ where: { id: record.id } });
  expect(
    (saved.data as { levels: { slides: unknown[] }[] }).levels[0].slides,
  ).toHaveLength(2);
});
for (const version of ["1.2", "2004"] as const)
  test(`${version} delivered multi-select ZIP saves partial credit, resumes selection and completes/reopens without duplicate penalties`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(installMockLms, version);
    const url = `http://127.0.0.1:4175/${version}/index.html`;
    const external: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    context.on("request", (r) => {
      if (!r.url().startsWith("http://127.0.0.1:4175/")) external.push(r.url());
    });
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: "Submit answer", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", { name: /Fixed protective barrier/ })
      .check();
    await page
      .getByRole("button", { name: "Submit answer", exact: true })
      .dblclick();
    await expect(page.getByTestId("life")).toHaveText("75%");
    await expect(page.getByTestId("multi-best-credit")).toHaveText("50%");
    const raw = version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw";
    const status =
      version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status";
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            (window as unknown as { __lmsValues: Record<string, string> })
              .__lmsValues[key],
          raw,
        ),
      )
      .toBe("50");
    expect(
      await page.evaluate(
        (key) =>
          (window as unknown as { __lmsValues: Record<string, string> })
            .__lmsValues[key],
        status,
      ),
    ).toBe("incomplete");
    await page
      .getByRole("button", { name: "Save and exit", exact: true })
      .click();
    const resumed = await context.newPage();
    await resumed.goto(url);
    await expect(
      resumed.getByRole("checkbox", { name: /Fixed protective barrier/ }),
    ).toBeChecked();
    await expect(
      resumed.getByRole("checkbox", { name: /Interlocked access gate/ }),
    ).not.toBeChecked();
    await expect(resumed.getByTestId("multi-best-credit")).toHaveText("50%");
    await expect(resumed.getByTestId("life")).toHaveText("75%");
    await resumed
      .getByRole("button", { name: "Submit answer", exact: true })
      .dblclick();
    await expect(resumed.getByTestId("life")).toHaveText("75%");
    await resumed
      .getByRole("checkbox", { name: /Interlocked access gate/ })
      .check();
    await resumed
      .getByRole("button", { name: "Submit answer", exact: true })
      .click();
    await expect(resumed.getByTestId("multi-best-credit")).toHaveText("100%");
    await resumed
      .getByRole("button", { name: "Finish learning", exact: true })
      .click();
    await expect(
      resumed.getByText("Completion submitted to the LMS.", { exact: true }),
    ).toBeVisible();
    await resumed
      .getByRole("button", { name: "Save and exit", exact: true })
      .click();
    const review = await context.newPage();
    await review.goto(`${url}?normal-entry=1`);
    await expect(
      review.getByRole("checkbox", { name: /Fixed protective barrier/ }),
    ).toBeChecked();
    await expect(
      review.getByRole("checkbox", { name: /Fixed protective barrier/ }),
    ).toBeDisabled();
    await expect(review.getByTestId("multi-best-credit")).toHaveText("100%");
    expect(
      await review.evaluate(
        (key) =>
          (window as unknown as { __lmsValues: Record<string, string> })
            .__lmsValues[key],
        raw,
      ),
    ).toBe("100");
    expect(
      await review.evaluate(
        (key) =>
          (window as unknown as { __lmsValues: Record<string, string> })
            .__lmsValues[key],
        status,
      ),
    ).toBe(version === "1.2" ? "passed" : "completed");
    await review.screenshot({
      path: `docs/phase3-1/screenshots/multi-select-${version}-review.png`,
      fullPage: true,
    });
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

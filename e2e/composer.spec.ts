import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createServer, type Server } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import { newCourse } from "../src/lib/course";
import {
  composerSlide,
  demoQuestion,
  demoFeedback,
} from "../src/lib/composer/sample";
import { newBlock } from "../src/lib/composer/model";
import { installMockLms } from "./fixtures/lms";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const fixtures = new Set<string>();
let server: Server;
const packages = new Map<string, Record<string, Uint8Array>>();
test.beforeAll(async () => {
  await mkdir("docs/composer/screenshots", { recursive: true });
  for (const version of ["1.2", "2004"])
    packages.set(
      version,
      unzipSync(
        await readFile(
          `deliverables/composer/Universal-Slide-Composer-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}.zip`,
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
    server.listen(4176, "127.0.0.1", resolve),
  );
});
test.afterEach(async () => {
  await db.course.deleteMany({ where: { id: { in: [...fixtures] } } });
  fixtures.clear();
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
async function create(page: Page, data: ReturnType<typeof newCourse>) {
  const r = await page.request.post("/api/courses", {
    headers: { origin: process.env.APP_ORIGIN || "http://localhost:3100" },
    data,
  });
  expect(r.status()).toBe(201);
  const record = await r.json();
  fixtures.add(record.id);
  await page.reload();
  await open(page, data.title);
  return record;
}
async function open(page: Page, title: string) {
  await page
    .locator(".course-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "Open course" })
    .click();
}
test("editor creates ordered regions/feedback, saves/reopens stable IDs and rejects an unreachable activity", async ({
  page,
}) => {
  await login(page);
  const title = `Composer author ${Date.now()}`,
    record = await create(page, newCourse(title));
  await page.getByLabel("Slide type").selectOption("composed");
  const contentTextarea = page.locator("label:has-text('Content text') textarea");
  await contentTextarea.fill("First ordered section");

  // Add second content block via palette
  await page
    .locator(".composer-palette-item")
    .filter({ hasText: "Text Content" })
    .click();
  await contentTextarea.fill("Second ordered section");

  // Reorder via Layers tab
  await page.getByRole("button", { name: /Layers/ }).click();
  await page
    .locator(".composer-layer-row")
    .nth(1)
    .getByRole("button", { name: "Move block up" })
    .click();

  // Add interaction block via Elements tab
  await page.getByRole("button", { name: "Elements" }).click();
  await page
    .locator(".composer-palette-item")
    .filter({ hasText: "Single Choice" })
    .click();
  await page.getByLabel("Prompt / Question").fill("Composed author question");

  // Add feedback block via palette
  await page.getByRole("button", { name: "Elements" }).click();
  await page
    .locator(".composer-palette-item")
    .filter({ hasText: "Conditional Feedback" })
    .click();
  await page
    .locator("label:has-text('Feedback message') textarea")
    .fill("Independent popup feedback");
  await page.getByLabel("Presentation").selectOption("popup");

  // Set layout to columns
  await page.getByLabel("Layout").selectOption("columns");

  // Set first block region to right
  await page.getByRole("button", { name: /Layers/ }).click();
  await page.locator(".composer-layer-row").first().click();
  await page.getByLabel("Region column").selectOption("right");

  // Add content after activity
  await page.getByRole("button", { name: "Elements" }).click();
  await page
    .locator(".composer-palette-item")
    .filter({ hasText: "Text Content" })
    .click();
  await contentTextarea.fill("After the activity");
  await page.getByLabel("Region column").selectOption("left");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  const before = await db.course.findUniqueOrThrow({
    where: { id: record.id },
  });
  await page.reload();
  await open(page, title);
  await expect(page.getByLabel("Layout")).toHaveValue("columns");
  await page.screenshot({
    path: "docs/composer/screenshots/editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const learner = page.locator(".learner");
  const left = learner.getByRole("region", {
    name: "Region left",
    exact: true,
  });
  expect(
    (await left.innerText()).indexOf("Composed author question"),
  ).toBeLessThan((await left.innerText()).indexOf("After the activity"));
  await left
    .getByRole("radio", { name: "Report hazard immediately", exact: true })
    .focus();
  await page.keyboard.press("Space");
  const submit = left.getByRole("button", {
    name: "Submit activity",
    exact: true,
  });
  await submit.click();
  await expect(page.getByRole("dialog")).toContainText(
    "Independent popup feedback",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(submit).toBeFocused();
  await learner
    .getByRole("button", { name: "Back to editor", exact: true })
    .click();
  expect(
    (await db.course.findUniqueOrThrow({ where: { id: record.id } })).data,
  ).toEqual(before.data);
  await page.getByRole("button", { name: /Layers/ }).click();
  const interactionRow = page
    .locator(".composer-layer-row")
    .filter({ hasText: "interaction" })
    .first();
  await interactionRow.getByRole("button", { name: "Hide block" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "unreachable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Save error" })).toContainText(
    "unreachable",
  );
  expect(
    (await db.course.findUniqueOrThrow({ where: { id: record.id } })).data,
  ).toEqual(before.data);
  await interactionRow.getByRole("button", { name: "Show block" }).click();
});
test("media-only content completes without a question and no schema migration", async ({
  page,
}) => {
  await login(page);
  const c = newCourse(`Composer media ${Date.now()}`);
  c.levels[0].slides = [
    composerSlide(
      "Media only",
      "media-only-slide",
      [
        {
          ...newBlock("media"),
          kind: "media",
          id: "media-only-block",
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHyQAAAAASUVORK5CYII=",
          alt: "A simple diagram",
        },
      ],
      { completion: { mode: "view", required: true, interactionIds: [] } },
    ),
  ];
  await create(page, c);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const learner = page.locator(".learner");
  await expect(
    learner.getByRole("img", { name: "A simple diagram", exact: true }),
  ).toBeVisible();
  await expect(learner.getByRole("radio")).toHaveCount(0);
  await expect(learner.getByRole("checkbox")).toHaveCount(0);
  await learner
    .getByRole("button", { name: "Finish learning", exact: true })
    .click();
  await expect(
    learner.getByText("Preview complete. Progress is temporary.", {
      exact: true,
    }),
  ).toBeVisible();
});
for (const version of ["1.2", "2004"] as const)
  test(`${version} standalone composer: manual content, independent feedback, re-entry/resume, mobile layout and completion`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(installMockLms, version);
    const url = `http://127.0.0.1:4176/${version}/index.html`;
    const external: string[] = [];
    const errors: string[] = [];
    context.on("request", (r) => {
      if (!r.url().startsWith("http://127.0.0.1:4176/")) external.push(r.url());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Mark slide complete", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Reveal details", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(
        "These required details are revealed by an explicit button action.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Two independent activities",
        exact: true,
      }),
    ).toBeFocused();
    let first = page.getByRole("region", {
      name: "First independent activity",
      exact: true,
    });
    await first.getByRole("radio", { name: "Answer B", exact: true }).check();
    await first
      .getByRole("button", { name: "Submit activity", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Review the first activity",
    );
    await page.keyboard.press("Escape");
    await expect(
      first.getByRole("button", { name: "Submit activity", exact: true }),
    ).toBeFocused();
    await first
      .getByRole("button", { name: "Submit activity", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("life")).toHaveText("75%");
    await first
      .getByRole("button", { name: "Retry activity", exact: true })
      .click();
    await expect(
      first.getByRole("radio", { name: "Answer B", exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByText("Retry feedback belongs only to the first activity.", {
        exact: true,
      }),
    ).toBeVisible();
    await first.getByRole("radio", { name: "Answer A", exact: true }).check();
    await first
      .getByRole("button", { name: "Submit activity", exact: true })
      .click();
    let second = page.getByRole("region", {
      name: "Second independent activity",
      exact: true,
    });
    await second
      .getByRole("checkbox", { name: "Demonstration choice A", exact: true })
      .check();
    const secondSubmit = second.getByRole("button", {
      name: "Submit activity",
      exact: true,
    });
    await secondSubmit.click();
    await expect(page.getByRole("dialog")).toContainText(
      "part of the second answer set",
    );
    await page.screenshot({
      path: `docs/composer/screenshots/overlay-${version}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(secondSubmit).toBeFocused();
    await expect(
      page.getByText(
        "First activity feedback remains independent of the second.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByTestId("life")).toHaveText("50%");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Save and exit", exact: true })
      .click();
    const resumed = await context.newPage();
    await resumed.goto(url);
    first = resumed.getByRole("region", {
      name: "First independent activity",
      exact: true,
    });
    second = resumed.getByRole("region", {
      name: "Second independent activity",
      exact: true,
    });
    await expect(
      first.getByRole("radio", { name: "Answer A", exact: true }),
    ).toBeChecked();
    await expect(
      second.getByRole("checkbox", {
        name: "Demonstration choice A",
        exact: true,
      }),
    ).toBeChecked();
    await expect(resumed.getByRole("dialog")).toHaveCount(0);
    await expect(resumed.getByTestId("life")).toHaveText("50%");
    await second
      .getByRole("button", { name: "Submit activity", exact: true })
      .click();
    await expect(resumed.getByRole("dialog")).toBeVisible();
    await resumed.keyboard.press("Escape");
    await expect(resumed.getByTestId("life")).toHaveText("50%");
    await resumed.setViewportSize({ width: 390, height: 844 });
    const regions = resumed.locator(".composer-region");
    const left = await regions.nth(0).boundingBox(),
      right = await regions.nth(1).boundingBox();
    expect(right!.y).toBeGreaterThanOrEqual(left!.y + left!.height);
    // verified mobile width
    expect(
      await resumed.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await resumed.screenshot({
      path: `docs/composer/screenshots/mobile-${version}.png`,
      fullPage: true,
    });
    await resumed.setViewportSize({ width: 1440, height: 1000 });
    await second
      .getByRole("checkbox", { name: "Demonstration choice B", exact: true })
      .check();
    await second
      .getByRole("button", { name: "Submit activity", exact: true })
      .click();
    await resumed
      .getByRole("button", { name: "Continue lesson", exact: true })
      .click();
    await expect(
      resumed.getByRole("button", { name: "Continue", exact: true }),
    ).toBeEnabled();
    await resumed.screenshot({
      path: `docs/composer/screenshots/mixed-${version}.png`,
      fullPage: true,
    });
    await resumed
      .getByRole("button", { name: "Previous", exact: true })
      .click();
    await expect(
      resumed.getByText(
        "These required details are revealed by an explicit button action.",
        { exact: true },
      ),
    ).toBeVisible();
    await resumed
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      resumed
        .getByRole("region", {
          name: "Second independent activity",
          exact: true,
        })
        .getByRole("checkbox", { name: "Demonstration choice B", exact: true }),
    ).toBeChecked();
    await resumed
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    const practice = resumed.getByRole("region", {
      name: "Optional unscored practice",
      exact: true,
    });
    await practice
      .getByRole("radio", { name: "Answer B", exact: true })
      .check();
    await practice
      .getByRole("button", { name: "Submit activity", exact: true })
      .click();
    await expect(resumed.getByTestId("life")).toHaveText("50%");
    await resumed
      .getByRole("button", { name: "Finish learning", exact: true })
      .click();
    await expect(
      resumed.getByText("Completion submitted to the LMS.", { exact: true }),
    ).toBeVisible();
    const values = await resumed.evaluate(
      () =>
        (window as unknown as { __lmsValues: Record<string, string> })
          .__lmsValues,
    );
    expect(
      values[version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"],
    ).toBe("100");
    expect(
      values[
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
      ],
    ).toBe(version === "1.2" ? "passed" : "completed");
    await resumed
      .getByRole("button", { name: "Save and exit", exact: true })
      .click();
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

test("multiple popup feedback blocks queue with trapped focus and independent inline feedback", async ({
  page,
}) => {
  await login(page);
  const c = newCourse(`Composer feedback queue ${Date.now()}`);
  const q = demoQuestion("queue-q", "Queued feedback activity");
  c.levels[0].slides = [
    composerSlide("Feedback queue", "queue-slide", [
      q,
      demoFeedback(
        "queue-a",
        q.id,
        "incorrect",
        "First independent popup",
        "main",
        "popup",
      ),
      demoFeedback(
        "queue-b",
        q.id,
        "incorrect",
        "Second independent popup",
        "main",
        "overlay",
      ),
      demoFeedback(
        "queue-inline",
        q.id,
        "incorrect",
        "Inline feedback remains visible",
      ),
    ]),
  ];
  await create(page, c);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const learner = page.locator(".learner");
  await learner.getByRole("radio", { name: "Answer B", exact: true }).check();
  const submit = learner.getByRole("button", {
    name: "Submit activity",
    exact: true,
  });
  await submit.click();
  await expect(page.getByRole("dialog")).toContainText(
    "First independent popup",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toContainText(
    "Second independent popup",
  );
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(submit).toBeFocused();
  await expect(
    learner.getByText("Inline feedback remains visible", { exact: true }),
  ).toBeVisible();
  await expect(learner.getByTestId("life")).toHaveText("75%");
});

test("resumed popup restores focus to its own activity after closing", async ({
  page,
  context,
}) => {
  await context.addInitScript(installMockLms, "2004" as const);
  const url = "http://127.0.0.1:4176/2004/index.html";
  await page.goto(url);
  await page
    .getByRole("button", { name: "Reveal details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark slide complete", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const first = page.getByRole("region", {
    name: "First independent activity",
    exact: true,
  });
  await first.getByRole("radio", { name: "Answer A", exact: true }).check();
  await first
    .getByRole("button", { name: "Submit activity", exact: true })
    .click();
  const second = page.getByRole("region", {
    name: "Second independent activity",
    exact: true,
  });
  await second
    .getByRole("checkbox", { name: "Demonstration choice A", exact: true })
    .check();
  await second
    .getByRole("button", { name: "Submit activity", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(url);
  await expect(reopened.getByRole("dialog")).toContainText(
    "part of the second answer set",
  );
  await reopened.keyboard.press("Escape");
  await expect(
    reopened
      .getByRole("region", { name: "Second independent activity", exact: true })
      .getByRole("button", { name: "Submit activity", exact: true }),
  ).toBeFocused();
});

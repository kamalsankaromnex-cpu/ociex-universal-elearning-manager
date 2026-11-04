import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import { installMockLms } from "./fixtures/lms";
let server: Server;
const packages = new Map<string, Record<string, Uint8Array>>();
test.beforeAll(async () => {
  for (const file of await readdir("deliverables/scorm"))
    if (file.endsWith(".zip"))
      packages.set(
        file.replace(".zip", ""),
        unzipSync(await readFile(`deliverables/scorm/${file}`)),
      );
  for (const version of ["1.2", "2004"] as const) {
    const qa = packages.get(
      `SCORM-Tracking-QA-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}`,
    );
    if (!qa)
      throw new Error(
        "Run npm run export:demo to generate multi-level QA packages",
      );
    packages.set(`fixture-${version}`, qa);
  }
  server = createServer((req, res) => {
    const [name, ...path] = decodeURIComponent((req.url || "").split("?")[0])
        .slice(1)
        .split("/"),
      file = path.join("/"),
      data = packages.get(name)?.[file];
    if (!data) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".html")
            ? "text/html"
            : file.endsWith(".woff2")
              ? "font/woff2"
              : "application/octet-stream",
    );
    res.end(data);
  });
  await new Promise<void>((r) => server.listen(4174, "127.0.0.1", r));
  await mkdir("docs/scorm/screenshots", { recursive: true });
});
test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});
for (const version of ["1.2", "2004"] as const)
  for (const scope of ["Level-01", "Full-Course"])
    test(`${version} ${scope}: standalone package, incomplete, life, bookmark/resume, pass and terminate`, async ({
      page,
      context,
    }) => {
      await context.addInitScript(installMockLms, version);
      const url = `http://127.0.0.1:4174/Daimler-EHS-${scope}-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}/index.html`;
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const external: string[] = [];
      context.on("request", (r) => {
        if (!r.url().startsWith("http://127.0.0.1:4174/"))
          external.push(r.url());
      });
      await page.goto(url);
      await expect(page.getByTestId("life")).toHaveText("100%");
      await expect
        .poll(() =>
          page.evaluate(
            (key) =>
              (window as unknown as { __lmsValues: Record<string, string> })
                .__lmsValues[key],
            version === "1.2"
              ? "cmi.core.lesson_status"
              : "cmi.completion_status",
          ),
        )
        .toBe("incomplete");
      await expect
        .poll(() =>
          page.evaluate(
            (key) =>
              (window as unknown as { __lmsValues: Record<string, string> })
                .__lmsValues[key],
            version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw",
          ),
        )
        .toBe("0");

      await page.getByRole("button", { name: "Vision Zero Challenge" }).click();
      await page.getByRole("radio", { name: /Demonstration option B/ }).check();
      await page.getByRole("button", { name: "Submit answer" }).click();
      await expect(page.getByTestId("life")).toHaveText("75%");
      await expect(
        page.getByRole("button", { name: "Finish learning", exact: true }),
      ).toBeDisabled();
      let values = await page.evaluate(
        () =>
          (window as unknown as { __lmsValues: Record<string, string> })
            .__lmsValues,
      );
      expect(
        values[
          version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
        ],
      ).toBe("incomplete");
      expect(
        values[version === "1.2" ? "cmi.core.lesson_location" : "cmi.location"],
      ).toBe("2");
      await page.close();
      const resumed = await context.newPage();
      await resumed.goto(url);
      await expect(resumed.getByTestId("life")).toHaveText("75%");
      await expect(
        resumed.getByRole("heading", { name: "Vision Zero Challenge" }),
      ).toBeVisible();
      await resumed
        .getByRole("radio", { name: /Demonstration option B/ })
        .check();
      await resumed.getByRole("button", { name: "Submit answer" }).click();
      await expect(resumed.getByTestId("life")).toHaveText("75%");
      await resumed
        .getByRole("radio", { name: /Demonstration option A/ })
        .check();
      await resumed.getByRole("button", { name: "Submit answer" }).click();
      await resumed
        .getByRole("button", { name: "Three Pillars of Vision Zero" })
        .click();
      await resumed
        .getByRole("button", { name: "Finish learning", exact: true })
        .click();
      await expect(
        resumed.getByText("Completion submitted to the LMS."),
      ).toBeVisible();
      values = await resumed.evaluate(
        () =>
          (window as unknown as { __lmsValues: Record<string, string> })
            .__lmsValues,
      );
      expect(
        values[
          version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
        ],
      ).toBe(version === "1.2" ? "passed" : "completed");
      expect(
        values[version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"],
      ).toBe("100");
      if (version === "2004") {
        expect(values["cmi.success_status"]).toBe("passed");
        expect(values["cmi.score.scaled"]).toBe("1");
        expect(values["cmi.objectives.0.id"]).toBe("course_objective");
        expect(values["cmi.objectives.0.success_status"]).toBe("passed");
        expect(values["cmi.objectives.0.completion_status"]).toBe("completed");
        expect(values["cmi.objectives.0.score.scaled"]).toBe("1");
      }
      await resumed.screenshot({
        path: `docs/scorm/screenshots/player-${version}-${scope}.png`,
        fullPage: true,
      });
      await resumed.getByRole("button", { name: "Save and exit" }).click();
      await expect(
        resumed.getByRole("heading", { name: "Session ended" }),
      ).toBeVisible();
      expect(
        await resumed.evaluate(
          () =>
            (window as unknown as { __lmsCalls: string[] }).__lmsCalls.filter(
              (c) => c === "Terminate",
            ).length,
        ),
      ).toBe(1);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });
for (const version of ["1.2", "2004"] as const)
  test(`${version}: recovery, shared life/stars, retry level, failed writes`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(installMockLms, version);
    await page.goto(`http://127.0.0.1:4174/fixture-${version}/index.html`);
    await page.getByRole("radio", { name: /Demonstration option B/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByTestId("life")).toHaveText("75%");
    await page.getByRole("radio", { name: /Demonstration option A/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await page.getByRole("button", { name: "Recovery", exact: false }).click();
    await page.getByRole("button", { name: "Restore 10% life" }).click();
    await expect(page.getByTestId("life")).toHaveText("85%");
    await expect(page.getByLabel("Level star earned")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Second competency", exact: false })
      .click();
    await page.getByRole("radio", { name: /Demonstration option B/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByTestId("life")).toHaveText("0%");
    await page.getByRole("button", { name: "Retry current level" }).click();
    await expect(page.getByTestId("life")).toHaveText("100%");
    await expect(page.getByLabel("Level star earned")).toHaveCount(1);
    await page.evaluate(() => {
      (window as unknown as { __failWrites: boolean }).__failWrites = true;
    });
    await page.getByRole("radio", { name: /Demonstration option A/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "failed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finish learning", exact: true }),
    ).toBeDisabled();
    await page.evaluate(() => {
      (window as unknown as { __failWrites: boolean }).__failWrites = false;
    });
    await page.getByRole("button", { name: "Retry LMS save" }).click();
    await expect(page.locator(".tracking-alert")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Optional reporting check", exact: false })
      .click();
    await page.getByRole("radio", { name: /Demonstration option A/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await page
      .getByRole("button", { name: "Finish learning", exact: true })
      .click();
    await expect(
      page.getByText("Completion submitted to the LMS."),
    ).toBeVisible();
  });
test("missing LMS API is explicit practice mode with no claimed LMS completion", async ({
  page,
}) => {
  await page.goto(
    "http://127.0.0.1:4174/Daimler-EHS-Level-01-SCORM-1.2/index.html",
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "LMS API unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finish learning", exact: true }),
  ).toBeDisabled();
});

test("2004 resumes canonical game state when the LMS bookmark is uninitialized (403)", async ({
  page,
  context,
}) => {
  await context.addInitScript(installMockLms, "2004" as const);
  const url =
    "http://127.0.0.1:4174/Daimler-EHS-Level-01-SCORM-2004-4th/index.html";
  await page.goto(url);
  await page.getByRole("button", { name: "Vision Zero Challenge" }).click();
  await page.getByRole("radio", { name: /Demonstration option B/ }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("life")).toHaveText("75%");
  await page.close();
  const resumed = await context.newPage();
  await resumed.goto(url + "?uninitialized-bookmark=1");
  await expect(resumed.getByTestId("life")).toHaveText("75%");
  await expect(
    resumed.getByRole("heading", { name: "Vision Zero Challenge" }),
  ).toBeVisible();
  await expect(resumed.locator(".tracking-alert")).toHaveCount(0);
  await expect
    .poll(() =>
      resumed.evaluate(
        () =>
          (window as unknown as { __lmsValues: Record<string, string> })
            .__lmsValues["cmi.completion_status"],
      ),
    )
    .toBe("incomplete");
  await resumed.screenshot({
    path: "docs/scorm/screenshots/scorm2004-403-resume-fixed.png",
    fullPage: true,
  });
});
for (const version of ["1.2", "2004"] as const) {
  test(`${version}: completed review preserves the LMS grade; explicit fresh attempt resets`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(installMockLms, version);
    const url = `http://127.0.0.1:4174/Daimler-EHS-Level-01-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}/index.html`;
    await page.goto(url);
    await page
      .getByRole("button", { name: "Three Pillars of Vision Zero" })
      .click();
    await page.getByRole("button", { name: "Vision Zero Challenge" }).click();
    await page.getByRole("radio", { name: /Demonstration option A/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await page
      .getByRole("button", { name: "Finish learning", exact: true })
      .click();
    await expect(
      page.getByText("Completion submitted to the LMS."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save and exit" }).click();
    await page.goto(url + "?normal-entry=1");
    await expect(
      page.getByText("Previously completed. Saved LMS result retained."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Learning complete", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Welcome to Vision Zero", exact: false })
      .click();
    const values = await page.evaluate(
      () =>
        (window as unknown as { __lmsValues: Record<string, string> })
          .__lmsValues,
    );
    expect(
      values[
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.completion_status"
      ],
    ).toBe(version === "1.2" ? "passed" : "completed");
    expect(
      values[version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"],
    ).toBe("100");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __lmsCalls: string[] }).__lmsCalls.filter(
            (c) => c.startsWith("cmi."),
          ).length,
      ),
    ).toBe(0);
    await page.getByRole("button", { name: "Save and exit" }).click();
    await page.goto(url + "?fresh-attempt=1");
    await expect(page.getByTestId("life")).toHaveText("100%");
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            (window as unknown as { __lmsValues: Record<string, string> })
              .__lmsValues[key],
          version === "1.2"
            ? "cmi.core.lesson_status"
            : "cmi.completion_status",
        ),
      )
      .toBe("incomplete");
    await expect(
      page.getByRole("button", { name: "Finish learning", exact: true }),
    ).toBeDisabled();
  });
  test(`${version}: cached-page restoration does not terminate a live session`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(installMockLms, version);
    await page.goto(
      `http://127.0.0.1:4174/Daimler-EHS-Level-01-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}/index.html`,
    );
    await page.getByRole("button", { name: "Vision Zero Challenge" }).click();
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __lmsCalls: string[] }).__lmsCalls.filter(
            (c) => c === "Terminate",
          ).length,
      ),
    ).toBe(0);
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await page.getByRole("radio", { name: /Demonstration option B/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByTestId("life")).toHaveText("75%");
    await expect(page.locator(".tracking-alert")).toHaveCount(0);
  });
  test(`${version}: failed progress save warns on reload and can be retried`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(installMockLms, version);
    await page.goto(
      `http://127.0.0.1:4174/Daimler-EHS-Level-01-SCORM-${version === "1.2" ? "1.2" : "2004-4th"}/index.html`,
    );
    await page.getByRole("button", { name: "Vision Zero Challenge" }).click();
    await page.evaluate(() => {
      (window as unknown as { __failWrites: boolean }).__failWrites = true;
    });
    await page.getByRole("radio", { name: /Demonstration option B/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.locator(".tracking-alert")).toContainText("failed");
    const warning = page.waitForEvent("dialog");
    const reload = page.reload({ timeout: 2000 }).catch(() => null);
    const dialog = await warning;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.dismiss();
    await reload;
    await expect(page.getByTestId("life")).toHaveText("75%");
    await page.evaluate(() => {
      (window as unknown as { __failWrites: boolean }).__failWrites = false;
    });
    await page.getByRole("button", { name: "Retry LMS save" }).click();
    await expect(page.locator(".tracking-alert")).toHaveCount(0);
  });
  test(`${version}: delivered two-level QA package reports optional assessment failure without bypassing competencies`, async ({
    page,
    context,
  }) => {
    await context.addInitScript(installMockLms, version);
    await page.goto(`http://127.0.0.1:4174/fixture-${version}/index.html`);
    await expect(
      page.getByRole("button", { name: "Finish learning", exact: true }),
    ).toBeDisabled();
    for (const name of ["First competency", "Second competency"]) {
      await page.getByRole("button", { name, exact: false }).click();
      await page.getByRole("radio", { name: /Demonstration option A/ }).check();
      await page.getByRole("button", { name: "Submit answer" }).click();
    }
    await page.getByRole("button", { name: "Recovery", exact: false }).click();
    await page
      .getByRole("button", { name: "Optional reporting check", exact: false })
      .click();
    await page.getByRole("radio", { name: /Demonstration option B/ }).check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await page
      .getByRole("button", { name: "Finish learning", exact: true })
      .click();
    await expect(
      page.getByText("Completion submitted to the LMS."),
    ).toBeVisible();
    const values = await page.evaluate(
      () =>
        (window as unknown as { __lmsValues: Record<string, string> })
          .__lmsValues,
    );
    expect(
      values[
        version === "1.2" ? "cmi.core.lesson_status" : "cmi.success_status"
      ],
    ).toBe("failed");
    expect(
      values[version === "1.2" ? "cmi.core.score.raw" : "cmi.score.raw"],
    ).toBe("67");
    if (version === "2004")
      expect(values["cmi.completion_status"]).toBe("completed");
    await page.screenshot({
      path: `docs/scorm/screenshots/qa-${version}-optional-failure.png`,
      fullPage: true,
    });
  });
}

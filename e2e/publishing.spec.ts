import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
test("Admin publishes only a committed validated revision and rejects stale export requests", async ({
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
  const name = `Publish test ${Date.now()}`;
  await page.getByLabel("Course name").fill(name);
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/courses") && r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  const record = await (await created).json();
  try {
    await page
      .getByLabel("Slide title", { exact: true })
      .fill("Committed export text");
    await page.getByRole("tab", { name: "Publishing", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Validate saved revision" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Export ZIP" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Validate saved revision" }).click();
    await expect(
      page.getByText("Validation passed", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("SCORM version").selectOption("2004");
    await expect(
      page.getByRole("button", { name: "Export ZIP" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Validate saved revision" }).click();
    await expect(
      page.getByText("Validation passed", { exact: true }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export ZIP" }).click();
    const asset = await download;
    const path = await asset.path();
    const files = unzipSync(await readFile(path!));
    expect(strFromU8(files["assets/course.js"])).toContain(
      "Committed export text",
    );
    expect(strFromU8(files["imsmanifest.xml"])).toContain("2004 4th Edition");
    const metadata = JSON.parse(strFromU8(files["export-metadata.json"]));
    expect(metadata.revision).toBe(2);
    await page.screenshot({
      path: "docs/scorm/screenshots/publishing-manager.png",
      fullPage: true,
    });
    const r = await page.request.post(`/api/courses/${record.id}/export`, {
      headers: { origin: "http://localhost:3000" },
      data: { revision: 1, version: "1.2", scope: "course" },
    });
    expect(r.status()).toBe(409);
    const validation = await page.request.post(
      `/api/courses/${record.id}/export`,
      {
        headers: { origin: "http://localhost:3000" },
        data: {
          revision: 2,
          version: "1.2",
          scope: "level",
          levelId: "missing",
          validateOnly: true,
        },
      },
    );
    expect(validation.status()).toBe(422);
  } finally {
    await db.course.deleteMany({ where: { id: record.id } });
    await db.$disconnect();
  }
});

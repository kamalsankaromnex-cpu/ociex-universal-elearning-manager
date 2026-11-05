import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mkdir } from "node:fs/promises";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const createdCourses = new Set<string>();

async function login(page: Page) {
  await page.goto("/");
  const emailInput = page.getByLabel("Email address");
  const coursesHeading = page.getByRole("heading", {
    name: "Your courses",
    exact: true,
  });
  await expect(emailInput.or(coursesHeading)).toBeVisible();
  if (await coursesHeading.isVisible()) return;

  await emailInput.fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(coursesHeading).toBeVisible();
}

async function captureScreen(page: Page, name: string) {
  const viewports = [
    { dir: "desktop", width: 1280, height: 800 },
    { dir: "tablet", width: 768, height: 1024 },
    { dir: "mobile", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(200); // settle layout
    await page.screenshot({
      path: `docs/screenshots/${vp.dir}/${name}.png`,
      fullPage: true,
    });
  }
  // Restore desktop
  await page.setViewportSize({ width: 1280, height: 800 });
}

test.beforeAll(async () => {
  await mkdir("docs/screenshots/desktop", { recursive: true });
  await mkdir("docs/screenshots/tablet", { recursive: true });
  await mkdir("docs/screenshots/mobile", { recursive: true });
});

test.afterAll(async () => {
  if (createdCourses.size > 0) {
    await db.course.deleteMany({ where: { id: { in: [...createdCourses] } } });
  }
  await db.$disconnect();
});

test("Daimler EHS Game Experience: authoring persistence and full learner playthrough across all viewports", async ({
  page,
}) => {
  test.setTimeout(180000);

  // 1. Log in to Workspace
  await login(page);

  // 2. Load Daimler EHS Demonstration
  const loadButton = page.getByRole("button", {
    name: "Load Daimler EHS Demo",
    exact: true,
  });
  await expect(loadButton).toBeVisible();
  await loadButton.click();

  // Wait for notification and editor to load
  await expect(
    page.getByText("Daimler EHS Game Experience loaded successfully"),
  ).toBeVisible();

  // The Course Editor should be open
  await expect(
    page.getByRole("heading", {
      name: "DICV EHS Refresher Training — Safety eModule",
      exact: true,
    }),
  ).toBeVisible();

  // Track the created course ID for cleanup
  const courseRecord = await db.course.findFirst({
    where: { title: "DICV EHS Refresher Training — Safety eModule" },
    orderBy: { createdAt: "desc" },
  });
  if (courseRecord) createdCourses.add(courseRecord.id);

  // 3. Visual Composer Editor Verification (Priority 1 & Requirement 7)
  // Verify 3 panels exist in the Visual Slide Composer
  const composerRegion = page.getByRole("region", {
    name: "Visual Slide Composer",
  });
  await expect(composerRegion).toBeVisible();
  const leftPanel = page.locator(".composer-panel-left");
  const centerPanel = page.locator(".composer-panel-center");
  const rightPanel = page.locator(".composer-panel-right");
  await expect(leftPanel).toBeVisible();
  await expect(centerPanel).toBeVisible();
  await expect(rightPanel).toBeVisible();

  // Switch to Layers tab on Left panel
  await leftPanel.getByRole("button", { name: /Layers/ }).click();
  await expect(leftPanel.locator(".composer-layer-row").first()).toBeVisible();

  // Switch back to Elements tab
  await leftPanel
    .getByRole("button", { name: "Elements", exact: true })
    .click();

  // Test Authoring Persistence: Edit slide title and save
  const slideTitleInput = page.getByLabel("Slide title");
  const originalTitle = await slideTitleInput.inputValue();
  const updatedTitle =
    "Welcome to Block 1: DICV Safety Culture (Validated)";
  await slideTitleInput.fill(updatedTitle);

  // Save changes
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();

  // Capture authoring editor screenshot
  await page.screenshot({
    path: "docs/screenshots/desktop/editor-visual-composer.png",
    fullPage: true,
  });

  // Reload page to verify persistence
  await page.reload();
  await page
    .locator(".course-card")
    .filter({
      has: page.getByRole("heading", {
        name: "DICV EHS Refresher Training — Safety eModule",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Open course" })
    .first()
    .click();
  await expect(page.getByLabel("Slide title")).toHaveValue(updatedTitle);

  // Restore original title
  await page.getByLabel("Slide title").fill(originalTitle);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();

  // 4. Enter Learner Game Mode via Preview Button
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const learner = page.locator(".learner");
  await expect(learner).toBeVisible();

  // Verify Daimler 2D Game HUD
  await expect(learner.locator(".game-brand-pill")).toBeVisible();
  await expect(learner.locator(".game-main-title")).toHaveText(
    "DICV EHS Refresher Training — Safety eModule",
  );
  await expect(learner.locator(".game-life-meter")).toBeVisible();
  await expect(learner.getByTestId("life")).toHaveText("100%");

  // =========================================================================
  // SLIDE 1: Welcome to Vision Zero (Content-Only Illustrated Scene)
  // =========================================================================
  await expect(
    learner
      .getByText("Welcome to Block 1: DICV Safety Culture & Vision Zero!")
      .first(),
  ).toBeVisible();
  await expect(
    learner.getByText("Block 1 Menu — Key Safety Milestones").first(),
  ).toBeVisible();
  await expect(learner.locator(".character-svg")).toBeVisible();

  // Capture Slide 1 screenshots across all 3 viewports
  await captureScreen(page, "slide-1-welcome");

  // Click "Begin Challenge >" action button
  await learner
    .getByRole("button", { name: "Begin Challenge >", exact: true })
    .click();

  // Click "Continue" to proceed to Slide 2
  await learner
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  // =========================================================================
  // SLIDE 2: Machine Guarding Multi-Select (Consequence Cards & Life Penalty)
  // =========================================================================
  await expect(
    learner
      .getByText(
        "If a colleague bypassed a machine guard to save time, what could happen next?",
      )
      .first(),
  ).toBeVisible();
  await expect(learner.getByText("The Scenario").first()).toBeVisible();

  // Verify all 5 consequence answer cards with custom icons are present
  const consequenceCards = learner.locator(".answer-card");
  await expect(consequenceCards).toHaveCount(5);
  await expect(learner.getByText("Injury to employees")).toBeVisible();
  await expect(learner.getByText("Damage to equipment")).toBeVisible();
  await expect(learner.getByText("Production disruption")).toBeVisible();
  await expect(learner.getByText("Environmental impact")).toBeVisible();
  await expect(
    learner.getByText("Financial and reputational loss"),
  ).toBeVisible();

  // Test Requirement 8: Life Penalty on incorrect answer
  // Select only 1 option (partial/incorrect)
  await learner
    .getByRole("checkbox", { name: "Injury to employees", exact: true })
    .check();

  // Submit
  const submitBtnSlide2 = learner.locator(
    "[data-composer-submit='d2:q-consequences']",
  );
  await submitBtnSlide2.click();

  // Assert Daimler approved default 25% life penalty (100% -> 75%)
  await expect(learner.getByTestId("life")).toHaveText("75%");

  // Verify incorrect feedback popup appears
  const feedbackDialog = page.getByRole("dialog");
  await expect(feedbackDialog).toBeVisible();
  await expect(feedbackDialog).toContainText(
    "Bypassing a machine guard jeopardizes every operational dimension",
  );

  // Close feedback dialog via Escape
  await page.keyboard.press("Escape");
  await expect(feedbackDialog).toHaveCount(0);

  // Now select all 5 consequence cards for complete success
  await page
    .getByRole("checkbox", { name: "Damage to equipment", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Production disruption", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Environmental impact", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Financial and reputational loss", exact: true })
    .check();

  // Submit complete answer
  await submitBtnSlide2.click();

  // Assert success feedback popup
  await expect(feedbackDialog).toBeVisible();
  await expect(feedbackDialog).toContainText(
    "Outstanding! All 5 consequences can result from bypassing a safety barrier.",
  );

  // Assert NO duplicate life penalty (life stays at 75%)
  await expect(page.getByTestId("life")).toHaveText("75%");

  // Close dialog
  await page.keyboard.press("Escape");
  await expect(feedbackDialog).toHaveCount(0);

  // Capture Slide 2 screenshots across all 3 viewports
  await captureScreen(page, "slide-2-machine-guard");

  // Advance to Slide 3
  await learner.getByRole("button", { name: "Continue", exact: true }).click();

  // =========================================================================
  // SLIDE 3: Safety Review Structure (Committee Routing Single-Choice)
  // =========================================================================
  await expect(
    learner
      .getByText("Which committee should review this issue?")
      .first(),
  ).toBeVisible();

  // Verify 3 committee cards
  const committeeCards = learner.locator(".answer-card");
  await expect(committeeCards).toHaveCount(3);
  await expect(learner.getByText("Apex Committee")).toBeVisible();
  await expect(learner.getByText("Sub Committee")).toBeVisible();
  await expect(
    learner.getByText("Ad-hoc Committee — Initiatives"),
  ).toBeVisible();

  // Select Apex Committee
  await learner
    .getByRole("radio", { name: "Apex Committee", exact: true })
    .check();

  // Submit
  const submitBtnSlide3 = learner.locator(
    "[data-composer-submit='d2b:q-committee']",
  );
  await submitBtnSlide3.click();

  // Verify correct feedback
  await expect(feedbackDialog).toBeVisible();
  await expect(feedbackDialog).toContainText(
    "Correct! The Apex Committee holds high-level governance authority",
  );
  await page.keyboard.press("Escape");
  await expect(feedbackDialog).toHaveCount(0);

  // Capture Slide 3 screenshots across all 3 viewports
  await captureScreen(page, "slide-3-committee");

  // Advance to Slide 4
  await learner.getByRole("button", { name: "Continue", exact: true }).click();

  // =========================================================================
  // SLIDE 4: Safety Culture & Video Start Overlay + Sequencing Staircase
  // =========================================================================
  await expect(
    learner
      .getByText("Safety Culture Evolution Briefing")
      .first(),
  ).toBeVisible();

  // Priority 5: Verify Video Start Overlay
  const startVideoBtn = learner.getByRole("button", {
    name: "Start Safety Briefing Video",
    exact: true,
  });
  await expect(startVideoBtn).toBeVisible();

  // Click start overlay button
  await startVideoBtn.click();

  // Verify overlay disappears and controls appear
  await expect(startVideoBtn).toHaveCount(0);
  const skipVideoBtn = learner.getByRole("button", {
    name: "Skip",
    exact: true,
  });
  await expect(skipVideoBtn).toBeVisible();

  // Skip video to trigger completion
  await skipVideoBtn.click();
  await expect(
    learner.getByText("Video Completed").first(),
  ).toBeVisible();

  // Verify Sequencing Staircase Challenge (Screen 2 inspired)
  await expect(
    learner
      .getByText(
        "Can you arrange the four safety culture stages in the correct order",
      )
      .first(),
  ).toBeVisible();

  // Place stages in correct order: Reactive -> Dependant -> Independent -> Interdependent
  await learner.getByRole("button", { name: /^Reactive/ }).click();
  await learner.getByRole("button", { name: /^Dependant/ }).click();
  await learner.getByRole("button", { name: /^Independent/ }).click();
  await learner.getByRole("button", { name: /^Interdependent/ }).click();

  // Submit sequencing challenge
  const submitBtnSeq = learner.locator("[data-composer-submit='d3:q-stages']");
  await submitBtnSeq.click();

  // Verify feedback popup dialog appears
  await expect(feedbackDialog).toBeVisible();
  await expect(feedbackDialog).toContainText("Splendid mastery!");
  await page.keyboard.press("Escape");
  await expect(feedbackDialog).toHaveCount(0);

  // Verify success banner
  await expect(
    learner.getByText("All stages correctly sequenced! Challenge complete.").first(),
  ).toBeVisible();

  // Capture Slide 4 screenshots across all 3 viewports
  await captureScreen(page, "slide-4-sequencing");

  // Advance to Slide 5
  await learner.getByRole("button", { name: "Continue", exact: true }).click();

  // =========================================================================
  // SLIDE 5: Shop-Floor Safety Standards (Side-by-Side Layout)
  // =========================================================================
  await expect(
    learner.getByText("Standard Operating Procedures (SOP)").first(),
  ).toBeVisible();

  // Question 1: PPE
  await learner
    .getByRole("radio", {
      name: "Safety eyewear & steel-toe shoes",
      exact: true,
    })
    .check();
  await learner.locator("[data-composer-submit='d4:q-ppe']").click();
  await expect(
    learner
      .getByText("Correct: Approved safety glasses with side shields")
      .first(),
  ).toBeVisible();

  // Question 2: Hazard oil spill
  await learner
    .getByRole("checkbox", {
      name: "Cordon off the immediate area",
      exact: true,
    })
    .check();
  await learner
    .getByRole("checkbox", {
      name: "Report to team leader / safety desk",
      exact: true,
    })
    .check();
  await learner.locator("[data-composer-submit='d4:q-hazard']").click();
  await expect(
    learner
      .getByText(
        "Correct: Immediate containment and escalation prevent slips and severe falls.",
      )
      .first(),
  ).toBeVisible();

  // Capture Slide 5 screenshots across all 3 viewports
  await captureScreen(page, "slide-5-side-by-side");

  // Advance to Slide 6
  await learner.getByRole("button", { name: "Continue", exact: true }).click();

  // =========================================================================
  // SLIDE 6: Safety Recovery Oasis (Life Recovery Station)
  // =========================================================================
  await expect(learner.getByTestId("life")).toHaveText("75%");

  // Click restore health button
  const rechargeBtn = learner.getByRole("button", {
    name: "Restore 25% life",
    exact: true,
  });
  await expect(rechargeBtn).toBeVisible();
  await rechargeBtn.click();

  // Verify Life restores to 100%
  await expect(learner.getByTestId("life")).toHaveText("100%");

  // Click Complete eModule > button
  await learner
    .getByRole("button", { name: "Complete eModule >", exact: true })
    .click();

  // Capture Slide 6 screenshots across all 3 viewports
  await captureScreen(page, "slide-6-recovery");

  // Verify Course Completion
  const finishBtn = learner.getByRole("button", {
    name: "Finish learning",
    exact: true,
  });
  await expect(finishBtn).toBeEnabled();
  await finishBtn.click();

  // Final check: game finished
  await expect(
    learner.getByRole("button", { name: "Learning complete", exact: true }),
  ).toBeVisible();

  // Capture final completion screenshot
  await page.screenshot({
    path: "docs/screenshots/desktop/course-completed.png",
    fullPage: true,
  });
});

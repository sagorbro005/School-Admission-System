import { test, expect } from "@playwright/test";

test("student can apply, pay and reopen the application", async ({ page }) => {
  const name = "Morning shift " + Date.now();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create class (Admin)", exact: true })
    .first()
    .click();
  await page.getByLabel("Class and shift name").fill(name);
  await page.getByLabel("Total seats").fill("1");
  await page
    .locator("form")
    .getByRole("button", { name: "Create class (Admin)" })
    .click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await card.getByRole("button", { name: "Apply for admission" }).click();
  await expect(page.getByRole("status")).toContainText("17-digit");
  await page
    .getByLabel("Student birth registration number")
    .fill("20001234567890123");
  await page.getByRole("button", { name: "Save ID" }).click();
  await card.getByRole("button", { name: "Apply for admission" }).click();
  const application = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(application).toContainText("HELD");
  await expect(application.getByText(/^Application ID: h_/)).toBeVisible();
  await application.getByRole("button", { name: "Pay admission fee" }).click();
  await expect(application).toContainText("CONFIRMED");
  await page.reload();
  await expect(
    page.getByLabel("Student birth registration number"),
  ).toHaveValue("20001234567890123");
  await page
    .getByRole("button", { name: "My applications", exact: true })
    .click();
  await expect(application).toContainText("CONFIRMED");
});

test("mobile layout keeps the student controls on screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Admissions desk" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "My applications" }).click();
  await expect(
    page.getByText("Save your student number to view your applications."),
  ).toBeVisible();
});

test("an expired seat reopens and payment becomes disabled without a reload", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.TEST_SHORT_HOLDS,
    "Requires a test API configured with a 15-second hold.",
  );
  const api = process.env.VITE_API_URL || "http://localhost:8080";
  const name = "Expiry check " + Date.now();
  const created = await request.post(api + "/classes", {
    data: { name, totalSeats: 1 },
  });
  expect(created.status()).toBe(201);
  await page.goto("/");
  await page
    .getByLabel("Student birth registration number")
    .fill("00000000000000001");
  await page.getByRole("button", { name: "Save ID" }).click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await card.getByRole("button", { name: "Apply for admission" }).click();
  await expect(card).toContainText("HELD");
  await expect(card).toContainText("EXPIRED", { timeout: 25000 });
  await expect(
    card.getByRole("button", { name: "Pay admission fee" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Classes", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Apply for admission" }),
  ).toBeEnabled({ timeout: 8000 });
});

test("a connection failure is visible and polling recovers", async ({
  page,
}) => {
  await page.route("**/classes", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Could not reach the admissions server",
  );
  await page.unroute("**/classes");
  await expect(page.getByRole("alert")).toHaveCount(0, { timeout: 8000 });
  await expect(
    page.getByRole("heading", { name: "Available classes" }),
  ).toBeVisible();
});

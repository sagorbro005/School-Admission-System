import { test, expect } from "@playwright/test";

test("student can apply, pay and reopen the application", async ({ page }) => {
  const name = "Morning shift " + Date.now();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create class", exact: true })
    .first()
    .click();
  await page.getByLabel("Class and shift name").fill(name);
  await page.getByLabel("Total seats").fill("1");
  await page
    .locator("form")
    .getByRole("button", { name: "Create class" })
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

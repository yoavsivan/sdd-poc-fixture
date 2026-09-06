import { expect, test } from "@playwright/test";
import { bearerContext, createKey, settingsLocators, signIn, uniqueSuffix } from "./helpers";

test("rotate keeps id and name and shows the new secret once", async ({ page }) => {
  await signIn(page);
  const name = `rotate-${uniqueSuffix()}`;
  const oldSecret = await createKey(page, name);
  const loc = settingsLocators(page);
  const row = loc.row.filter({ hasText: name });
  const before = await row.getAttribute("data-key-id");
  await row.getByTestId("api-key-rotate").click();
  const newSecret = (await loc.plaintext.innerText()).trim();
  expect(newSecret.length).toBeGreaterThan(0);
  expect(newSecret).not.toBe(oldSecret);
  await expect(row).toContainText(name);
  const after = await row.getAttribute("data-key-id");
  if (before) expect(after).toBe(before);
  await page.goto("/settings");
  await expect(page.getByTestId("api-key-plaintext")).toHaveCount(0);
  await expect(page.getByTestId("api-key-row").filter({ hasText: name })).toBeVisible();
});

test("old secret fails immediately, new secret works", async ({ page }) => {
  await signIn(page);
  const name = `swap-${uniqueSuffix()}`;
  const oldSecret = await createKey(page, name);
  const row = page.getByTestId("api-key-row").filter({ hasText: name });
  await row.getByTestId("api-key-rotate").click();
  const newSecret = (await page.getByTestId("api-key-plaintext").innerText()).trim();
  const oldCtx = await bearerContext(oldSecret);
  const oldRes = await oldCtx.get("/api/items");
  expect(oldRes.status()).toBe(401);
  expect(await oldRes.json()).toEqual({ error: "unauthorized" });
  await oldCtx.dispose();
  const newCtx = await bearerContext(newSecret);
  expect((await newCtx.get("/api/items")).status()).toBe(200);
  await newCtx.dispose();
});

test("last rotated is shown after rotation", async ({ page }) => {
  await signIn(page);
  const name = `stamp-${uniqueSuffix()}`;
  await createKey(page, name);
  const row = page.getByTestId("api-key-row").filter({ hasText: name });
  await row.getByTestId("api-key-rotate").click();
  await expect(row.getByTestId("api-key-last-rotated")).not.toHaveText("");
  await page.goto("/settings");
  await expect(page.getByTestId("api-key-row").filter({ hasText: name }).getByTestId("api-key-last-rotated")).not.toHaveText("");
});

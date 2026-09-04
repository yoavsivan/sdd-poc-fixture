import { expect, test } from "@playwright/test";
import { createItemViaUi, signIn, uniqueSuffix } from "./helpers.ts";

test("sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin\?next=%2Fitems$/);
  await page.getByTestId("signin-username").fill("demo");
  await page.getByTestId("signin-password").fill("demo-pass-1234");
  await page.getByTestId("signin-submit").click();
  await expect(page).toHaveURL(/\/items$/);
  await expect(page.getByTestId("nav-user")).toHaveText("demo");
  await expect(page.getByTestId("nav-signout")).toBeVisible();
});

test("add item", async ({ page }) => {
  const suffix = uniqueSuffix();
  const title = `Smoke ${suffix}`;
  const tag = `smoke-${suffix}`;
  await signIn(page);
  await createItemViaUi(page, {
    url: `https://example.com/smoke-${suffix}`,
    title,
    note: "recorded by the smoke suite",
    tags: tag,
  });
  const row = page.getByTestId("item-row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("tag-chip")).toHaveText(tag);
});

test("tag filter", async ({ page }) => {
  const suffix = uniqueSuffix();
  const alphaTag = `alpha-${suffix}`;
  const betaTag = `beta-${suffix}`;
  const alphaTitle = `Alpha ${suffix}`;
  const betaTitle = `Beta ${suffix}`;
  await signIn(page);
  await createItemViaUi(page, {
    url: `https://example.com/alpha-${suffix}`,
    title: alphaTitle,
    tags: alphaTag,
  });
  await createItemViaUi(page, {
    url: `https://example.com/beta-${suffix}`,
    title: betaTitle,
    tags: betaTag,
  });
  await page.getByTestId(`tag-filter-${alphaTag}`).click();
  await expect(page).toHaveURL(new RegExp(`\\?tag=${alphaTag}`));
  await expect(page.getByTestId("item-row")).toHaveCount(1);
  await expect(page.getByTestId("item-row")).toContainText(alphaTitle);
  await page.getByTestId("tag-filter-clear").click();
  await expect(page.getByTestId("item-row").filter({ hasText: alphaTitle })).toBeVisible();
  await expect(page.getByTestId("item-row").filter({ hasText: betaTitle })).toBeVisible();
});

test("/api/items with cookie", async ({ page, request }) => {
  const suffix = uniqueSuffix();
  await signIn(page);
  await createItemViaUi(page, {
    url: `https://example.com/api-${suffix}`,
    title: `Api ${suffix}`,
    tags: `api-${suffix}`,
  });
  const withCookie = await page.request.get(`/api/items?q=${suffix}`);
  expect(withCookie.status()).toBe(200);
  const body = await withCookie.json();
  expect(body).toHaveProperty("count");
  expect(Array.isArray(body.items)).toBe(true);
  const anon = await request.get("/api/items");
  expect(anon.status()).toBe(401);
  expect(await anon.text()).toBe('{"error":"unauthorized"}');
});

import { expect, test } from "@playwright/test";
import { bearerContext, createItemViaUi, createKey, settingsLocators, signIn, uniqueSuffix } from "./helpers";

test("create key shows plaintext once and lists name + created", async ({ page }) => {
  await signIn(page);
  const name = `key-${uniqueSuffix()}`;
  const secret = await createKey(page, name);
  expect(secret.length).toBeGreaterThan(0);
  const loc = settingsLocators(page);
  const row = loc.row.filter({ hasText: name });
  await expect(loc.plaintext).toBeVisible();
  await expect(row).toBeVisible();
  await expect(row.getByTestId("api-key-created")).not.toHaveText("");
  await page.goto("/settings");
  await expect(page.getByTestId("api-key-plaintext")).toHaveCount(0);
  const listed = page.getByTestId("api-key-row").filter({ hasText: name });
  await expect(listed).toBeVisible();
  await expect(listed.getByTestId("api-key-created")).not.toHaveText("");
});

test("bearer authenticates /api/items without a cookie", async ({ page }) => {
  await signIn(page);
  const suffix = uniqueSuffix();
  const title = `Bearer item ${suffix}`;
  await createItemViaUi(page, { url: `https://example.invalid/${suffix}`, title });
  const secret = await createKey(page, `bearer-${suffix}`);
  const ctx = await bearerContext(secret);
  const res = await ctx.get("/api/items");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.items)).toBe(true);
  expect(typeof body.count).toBe("number");
  expect(body.items.some((it: { title: string }) => it.title === title)).toBe(true);
  await ctx.dispose();
});

test("missing or invalid bearer is 401 with the exact body", async ({ playwright }) => {
  const baseURL = process.env.BASE_URL || "http://localhost:3000";
  const ctx = await playwright.request.newContext({ baseURL });
  const missing = await ctx.get("/api/items");
  expect(missing.status()).toBe(401);
  expect(await missing.json()).toEqual({ error: "unauthorized" });
  const invalid = await ctx.get("/api/items", { headers: { Authorization: "Bearer not-a-key" } });
  expect(invalid.status()).toBe(401);
  expect(await invalid.json()).toEqual({ error: "unauthorized" });
  await ctx.dispose();
});

test("cookie sessions still work", async ({ page }) => {
  await signIn(page);
  const suffix = uniqueSuffix();
  await createItemViaUi(page, { url: `https://example.invalid/cookie-${suffix}`, title: `Cookie ${suffix}` });
  const res = await page.request.get("/api/items");
  expect(res.status()).toBe(200);
  await page.goto("/items");
  await expect(page.getByTestId("item-row").first()).toBeVisible();
});

test("revoke is immediate and last used updates", async ({ page }) => {
  await signIn(page);
  const suffix = uniqueSuffix();
  const name = `revoke-${suffix}`;
  const secret = await createKey(page, name);
  const ctx = await bearerContext(secret);
  expect((await ctx.get("/api/items")).status()).toBe(200);
  await page.goto("/settings");
  const row = page.getByTestId("api-key-row").filter({ hasText: name });
  await expect(row.getByTestId("api-key-last-used")).not.toHaveText("");
  await row.getByTestId("api-key-revoke").click();
  const after = await ctx.get("/api/items");
  expect(after.status()).toBe(401);
  expect(await after.json()).toEqual({ error: "unauthorized" });
  await ctx.dispose();
});

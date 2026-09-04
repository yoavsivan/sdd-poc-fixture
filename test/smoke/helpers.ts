import type { Page } from "@playwright/test";

/** Unique suffix so smoke tests can share one running app. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fill the sign-in form as the demo user. */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("signin-username").fill("demo");
  await page.getByTestId("signin-password").fill("demo-pass-1234");
  await page.getByTestId("signin-submit").click();
  await page.waitForURL(/\/items/);
}

export async function createItemViaUi(
  page: Page,
  fields: { url: string; title: string; note?: string; tags?: string },
): Promise<void> {
  await page.getByTestId("item-new").click();
  await page.getByTestId("item-url").fill(fields.url);
  await page.getByTestId("item-title").fill(fields.title);
  if (fields.note) await page.getByTestId("item-note").fill(fields.note);
  if (fields.tags) await page.getByTestId("item-tags").fill(fields.tags);
  await page.getByTestId("item-save").click();
}

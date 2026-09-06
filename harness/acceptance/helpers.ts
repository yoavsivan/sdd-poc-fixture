import { request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

/** Unique suffix so acceptance tests can share one running app. */
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

export function settingsLocators(page: Page) {
  return {
    section: page.getByTestId("api-keys-section"),
    name: page.getByTestId("api-key-name"),
    create: page.getByTestId("api-key-create"),
    plaintext: page.getByTestId("api-key-plaintext"),
    row: page.getByTestId("api-key-row"),
    created: page.getByTestId("api-key-created"),
    lastUsed: page.getByTestId("api-key-last-used"),
    revoke: page.getByTestId("api-key-revoke"),
    rotate: page.getByTestId("api-key-rotate"),
    lastRotated: page.getByTestId("api-key-last-rotated"),
  };
}

/** Create a named key from Settings and return the one-time plaintext secret. */
export async function createKey(page: Page, name: string): Promise<string> {
  await page.goto("/settings");
  const loc = settingsLocators(page);
  await loc.section.waitFor();
  await loc.name.fill(name);
  await loc.create.click();
  const secret = (await loc.plaintext.innerText()).trim();
  if (!secret) throw new Error("createKey: empty plaintext");
  return secret;
}

export async function bearerContext(secret: string): Promise<APIRequestContext> {
  const baseURL = process.env.BASE_URL || "http://localhost:3000";
  return playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${secret}` },
  });
}

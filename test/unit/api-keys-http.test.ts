import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

function extractPlaintext(html: string): string {
  const match = html.match(/data-testid="api-key-plaintext"[^>]*>([^<]+)</);
  if (!match) throw new Error("api-key-plaintext not found");
  return match[1];
}

async function createNamedKey(
  app: ReturnType<typeof makeTestApp>,
  cookie: string,
  name: string,
): Promise<{ secret: string; html: string }> {
  const page = await request(app).get("/settings").set("Cookie", cookie);
  const csrf = extractCsrf(page.text);
  const posted = await request(app)
    .post("/settings/api-keys")
    .set("Cookie", cookie)
    .type("form")
    .send({ _csrf: csrf, name })
    .redirects(0);
  expect(posted.status).toBe(302);
  expect(posted.headers.location).toBe("/settings");
  const shown = await request(app).get("/settings").set("Cookie", cookie);
  expect(shown.status).toBe(200);
  const secret = extractPlaintext(shown.text);
  return { secret, html: shown.text };
}

describe("api-keys http", () => {
  it("creates a named key, shows plaintext once, and lists name plus created date", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const { secret, html } = await createNamedKey(app, cookie, "scripts");
    expect(secret.length).toBeGreaterThan(0);
    expect(html).toContain('data-testid="api-keys-section"');
    expect(html).toContain('data-testid="api-key-row"');
    expect(html).toContain("scripts");
    expect(html).toMatch(/data-testid="api-key-created"[^>]*>\d{4}-\d{2}-\d{2}/);
    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    expect(reload.text).not.toContain(secret);
  });

  it("GET /api/items with Bearer secret and no cookie returns items including a UI-created row", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const newPage = await request(app).get("/items/new").set("Cookie", cookie);
    const itemCsrf = extractCsrf(newPage.text);
    const saved = await request(app)
      .post("/items")
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: itemCsrf,
        url: "https://example.com/bearer-item",
        title: "Bearer item",
        note: "",
        tags: "api",
      })
      .redirects(0);
    expect(saved.status).toBe(302);
    const { secret } = await createNamedKey(app, cookie, "ci");
    const res = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((it: { title: string }) => it.title === "Bearer item")).toBe(true);
  });

  it('missing header or Bearer not-a-key returns 401 {"error":"unauthorized"}', async () => {
    const app = makeTestApp();
    const missing = await request(app).get("/api/items");
    expect(missing.status).toBe(401);
    expect(missing.text).toBe('{"error":"unauthorized"}');
    const bogus = await request(app).get("/api/items").set("Authorization", "Bearer not-a-key");
    expect(bogus.status).toBe(401);
    expect(bogus.body).toEqual({ error: "unauthorized" });
    expect(bogus.text).toBe('{"error":"unauthorized"}');
  });

  it("cookie sessions still work for GET /api/items", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app).get("/api/items").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("count");
    const page = await request(app).get("/items").set("Cookie", cookie);
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/data-testid="item-row"|data-testid="items-empty"/);
  });

  it("last used is shown after Bearer use; revoke is immediate 401", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const { secret, html: createdHtml } = await createNamedKey(app, cookie, "temp");
    expect(createdHtml).not.toContain('data-testid="api-key-last-used"');
    const used = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(used.status).toBe(200);
    const afterUse = await request(app).get("/settings").set("Cookie", cookie);
    expect(afterUse.text).toMatch(/data-testid="api-key-last-used"[^>]*>\d{4}-\d{2}-\d{2}/);
    const csrf = extractCsrf(afterUse.text);
    const revokeMatch = afterUse.text.match(/action="\/settings\/api-keys\/(\d+)\/revoke"/);
    expect(revokeMatch).toBeTruthy();
    const revoke = await request(app)
      .post(`/settings/api-keys/${revokeMatch![1]}/revoke`)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf })
      .redirects(0);
    expect(revoke.status).toBe(302);
    const denied = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(denied.status).toBe(401);
    expect(denied.text).toBe('{"error":"unauthorized"}');
  });

  it("rotate keeps the row, shows new secret once, and retires the old Bearer token", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const { secret: oldSecret, html: createdHtml } = await createNamedKey(app, cookie, "scripts");
    expect(createdHtml).toContain("scripts");
    expect(createdHtml).not.toContain('data-testid="api-key-last-rotated"');
    const rotateMatch = createdHtml.match(/action="\/settings\/api-keys\/(\d+)\/rotate"/);
    expect(rotateMatch).toBeTruthy();
    const csrf = extractCsrf(createdHtml);
    const rotated = await request(app)
      .post(`/settings/api-keys/${rotateMatch![1]}/rotate`)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf })
      .redirects(0);
    expect(rotated.status).toBe(302);
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const newSecret = extractPlaintext(shown.text);
    expect(newSecret.length).toBeGreaterThan(0);
    expect(newSecret).not.toBe(oldSecret);
    expect(shown.text).toContain("scripts");
    expect(shown.text).toMatch(/data-testid="api-key-last-rotated"[^>]*>\d{4}-\d{2}-\d{2}/);
    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    const oldDenied = await request(app).get("/api/items").set("Authorization", `Bearer ${oldSecret}`);
    expect(oldDenied.status).toBe(401);
    expect(oldDenied.text).toBe('{"error":"unauthorized"}');
    const fresh = await request(app).get("/api/items").set("Authorization", `Bearer ${newSecret}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body).toHaveProperty("items");
    expect(fresh.body).toHaveProperty("count");
  });
});

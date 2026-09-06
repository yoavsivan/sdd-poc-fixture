import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

async function createNamedKey(
  app: ReturnType<typeof makeTestApp>,
  cookie: string,
  name: string,
): Promise<{ plaintext: string; html: string }> {
  const page = await request(app).get("/settings").set("Cookie", cookie);
  const csrf = extractCsrf(page.text);
  const posted = await request(app)
    .post("/settings/api-keys")
    .redirects(0)
    .set("Cookie", cookie)
    .type("form")
    .send({ _csrf: csrf, name });
  expect(posted.status).toBe(302);
  const shown = await request(app).get("/settings").set("Cookie", cookie);
  const match = shown.text.match(/data-testid="api-key-plaintext">([^<]+)</);
  expect(match).toBeTruthy();
  return { plaintext: match![1], html: shown.text };
}

describe("api-key http", () => {
  it("create shows plaintext once; reload hides it; row has name and created date", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await createNamedKey(app, cookie, "Scripts");
    expect(created.plaintext.length).toBeGreaterThan(0);
    expect(created.html).toContain('data-testid="api-keys-section"');
    expect(created.html).toContain('data-testid="api-key-row"');
    expect(created.html).toContain("Scripts");
    expect(created.html).toMatch(/data-testid="api-key-created">\d{4}-\d{2}-\d{2}</);
    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    expect(reload.text).toContain('data-testid="api-key-row"');
  });

  it("GET /api/items with Bearer secret and no cookie returns 200 items and count", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const itemPage = await request(app).get("/items/new").set("Cookie", cookie);
    const csrf = extractCsrf(itemPage.text);
    const saved = await request(app)
      .post("/items")
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: csrf,
        url: "https://example.com/via-ui",
        title: "Via UI",
        note: "",
        tags: "later",
      });
    expect(saved.status).toBe(302);
    const { plaintext } = await createNamedKey(app, cookie, "CLI");
    const res = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${plaintext}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty("count");
    expect(res.body.items.some((it: { title: string }) => it.title === "Via UI")).toBe(true);
  });

  it("missing Authorization or Bearer not-a-key returns exact 401 body", async () => {
    const app = makeTestApp();
    const missing = await request(app).get("/api/items");
    expect(missing.status).toBe(401);
    expect(missing.text).toBe('{"error":"unauthorized"}');
    const bad = await request(app).get("/api/items").set("Authorization", "Bearer not-a-key");
    expect(bad.status).toBe(401);
    expect(bad.text).toBe('{"error":"unauthorized"}');
  });

  it("cookie session still lists items; last used appears after Bearer; revoke is immediate", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const withCookie = await request(app).get("/api/items").set("Cookie", cookie);
    expect(withCookie.status).toBe(200);
    await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({ url: "https://example.com/row", title: "Row item" });
    const itemsPage = await request(app).get("/items").set("Cookie", cookie);
    expect(itemsPage.status).toBe(200);
    expect(itemsPage.text).toContain('data-testid="item-row"');
    const { plaintext, html: afterCreate } = await createNamedKey(app, cookie, "Temp");
    expect(afterCreate).not.toContain('data-testid="api-key-last-used"');
    const used = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${plaintext}`);
    expect(used.status).toBe(200);
    const settings = await request(app).get("/settings").set("Cookie", cookie);
    expect(settings.text).toMatch(/data-testid="api-key-last-used">\d{4}-\d{2}-\d{2}</);
    const revokeCsrf = extractCsrf(settings.text);
    const idMatch = settings.text.match(/action="\/settings\/api-keys\/(\d+)\/revoke"/);
    expect(idMatch).toBeTruthy();
    const revoked = await request(app)
      .post(`/settings/api-keys/${idMatch![1]}/revoke`)
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: revokeCsrf });
    expect(revoked.status).toBe(302);
    const again = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${plaintext}`);
    expect(again.status).toBe(401);
    expect(again.text).toBe('{"error":"unauthorized"}');
  });

  it("rotate keeps name, shows new secret once, retires old Bearer, shows last rotated", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const { plaintext: oldSecret, html: createdHtml } = await createNamedKey(app, cookie, "CI");
    expect(createdHtml).toContain("CI");
    const idMatch = createdHtml.match(/action="\/settings\/api-keys\/(\d+)\/rotate"/);
    expect(idMatch).toBeTruthy();
    const csrf = extractCsrf(createdHtml);
    const posted = await request(app)
      .post(`/settings/api-keys/${idMatch![1]}/rotate`)
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf });
    expect(posted.status).toBe(302);
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const match = shown.text.match(/data-testid="api-key-plaintext">([^<]+)</);
    expect(match).toBeTruthy();
    const fresh = match![1];
    expect(fresh).not.toBe(oldSecret);
    expect(shown.text).toContain("CI");
    expect(shown.text).toMatch(/data-testid="api-key-last-rotated">\d{4}-\d{2}-\d{2}</);
    const oldRes = await request(app).get("/api/items").set("Authorization", `Bearer ${oldSecret}`);
    expect(oldRes.status).toBe(401);
    expect(oldRes.text).toBe('{"error":"unauthorized"}');
    const newRes = await request(app).get("/api/items").set("Authorization", `Bearer ${fresh}`);
    expect(newRes.status).toBe(200);
    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
  });
});

import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

function extractPlaintext(html: string): string {
  const m = html.match(/data-testid="api-key-plaintext"[^>]*>([^<]+)</);
  if (!m) throw new Error("plaintext locator not found");
  return m[1].trim();
}

function extractCreated(html: string): string {
  const m = html.match(/data-testid="api-key-created"[^>]*>([^<]+)</);
  if (!m) throw new Error("created locator not found");
  return m[1].trim();
}

function extractLastUsed(html: string): string {
  const m = html.match(/data-testid="api-key-last-used"[^>]*>([^<]+)</);
  if (!m) throw new Error("last-used locator not found");
  return m[1].trim();
}

function extractLastRotated(html: string): string {
  const m = html.match(/data-testid="api-key-last-rotated"[^>]*>([^<]+)</);
  if (!m) throw new Error("last-rotated locator not found");
  return m[1].trim();
}

async function createNamedKey(
  app: ReturnType<typeof makeTestApp>,
  cookie: string,
  name: string,
) {
  const page = await request(app).get("/settings").set("Cookie", cookie);
  const csrf = extractCsrf(page.text);
  const created = await request(app)
    .post("/settings/api-keys")
    .set("Cookie", cookie)
    .type("form")
    .send({ _csrf: csrf, name });
  return created;
}

describe("api-keys", () => {
  it("creates a named key, shows plaintext once, lists name and created date", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await createNamedKey(app, cookie, "cli");
    expect(created.status).toBe(200);
    expect(created.text).toContain('data-testid="api-keys-section"');
    expect(created.text).toContain('data-testid="api-key-row"');
    expect(created.text).toContain("cli");
    const secret = extractPlaintext(created.text);
    expect(secret.length).toBeGreaterThan(0);
    expect(secret.startsWith("smk_")).toBe(true);
    const createdDate = extractCreated(created.text);
    expect(createdDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.status).toBe(200);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    expect(reload.text).toContain("cli");
    expect(extractCreated(reload.text)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects an empty key name", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await createNamedKey(app, cookie, "   ");
    expect(created.status).toBe(400);
    expect(created.text).not.toContain('data-testid="api-key-plaintext"');
    expect(created.text).toMatch(/Name is required/);
  });

  it("GET /api/items with Bearer secret returns items including a UI-created row", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/items/new").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    const posted = await request(app)
      .post("/items")
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: csrf,
        url: "https://example.com/key-item",
        title: "Key Item",
        note: "",
        tags: "keys",
      });
    expect(posted.status).toBe(302);

    const created = await createNamedKey(app, cookie, "script");
    const secret = extractPlaintext(created.text);
    const res = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((it: { title: string }) => it.title === "Key Item")).toBe(true);
  });

  it("missing header and Bearer not-a-key return exact 401 body", async () => {
    const app = makeTestApp();
    const missing = await request(app).get("/api/items");
    expect(missing.status).toBe(401);
    expect(missing.text).toBe('{"error":"unauthorized"}');
    const bad = await request(app).get("/api/items").set("Authorization", "Bearer not-a-key");
    expect(bad.status).toBe(401);
    expect(bad.text).toBe('{"error":"unauthorized"}');
  });

  it("cookie GET /api/items still works; bad Bearer wins over a valid cookie", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const withCookie = await request(app).get("/api/items").set("Cookie", cookie);
    expect(withCookie.status).toBe(200);
    const both = await request(app)
      .get("/api/items")
      .set("Cookie", cookie)
      .set("Authorization", "Bearer not-a-key");
    expect(both.status).toBe(401);
    expect(both.text).toBe('{"error":"unauthorized"}');
  });

  it("shows last used after Bearer auth and revoke is immediate", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await createNamedKey(app, cookie, "rotate-me");
    const secret = extractPlaintext(created.text);
    const used = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(used.status).toBe(200);

    const afterUse = await request(app).get("/settings").set("Cookie", cookie);
    expect(extractLastUsed(afterUse.text)).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const csrf = extractCsrf(afterUse.text);
    const idMatch = afterUse.text.match(/action="\/settings\/api-keys\/(\d+)\/revoke"/);
    expect(idMatch).toBeTruthy();
    const revoked = await request(app)
      .post(`/settings/api-keys/${idMatch![1]}/revoke`)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf });
    expect(revoked.status).toBe(302);

    const again = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(again.status).toBe(401);
    expect(again.text).toBe('{"error":"unauthorized"}');
  });

  it("rotate keeps name, shows new secret once, retires the old secret, shows last rotated", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await createNamedKey(app, cookie, "cli");
    const oldSecret = extractPlaintext(created.text);
    expect(created.text.match(/data-testid="api-key-row"/g)?.length).toBe(1);

    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    const idMatch = page.text.match(/action="\/settings\/api-keys\/(\d+)\/rotate"/);
    expect(idMatch).toBeTruthy();
    const rotated = await request(app)
      .post(`/settings/api-keys/${idMatch![1]}/rotate`)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf });
    expect(rotated.status).toBe(200);
    const newSecret = extractPlaintext(rotated.text);
    expect(newSecret.length).toBeGreaterThan(0);
    expect(newSecret).not.toBe(oldSecret);
    expect(rotated.text).toContain("cli");
    expect(rotated.text.match(/data-testid="api-key-row"/g)?.length).toBe(1);

    const oldRes = await request(app).get("/api/items").set("Authorization", `Bearer ${oldSecret}`);
    expect(oldRes.status).toBe(401);
    expect(oldRes.text).toBe('{"error":"unauthorized"}');
    const newRes = await request(app).get("/api/items").set("Authorization", `Bearer ${newSecret}`);
    expect(newRes.status).toBe(200);

    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    expect(extractLastRotated(reload.text)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reload.text.match(/data-testid="api-key-row"/g)?.length).toBe(1);
  });
});

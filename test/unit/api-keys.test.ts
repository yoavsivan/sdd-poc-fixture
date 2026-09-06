import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApiKey, listApiKeys } from "../../src/api-keys/repo.ts";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import { ensureSeedUser } from "../../src/db/seed.ts";
import { findByUsername } from "../../src/users/repo.ts";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

async function createNamedKey(
  app: ReturnType<typeof makeTestApp>,
  cookie: string,
  name: string,
): Promise<string> {
  const settings = await request(app).get("/settings").set("Cookie", cookie);
  const csrf = extractCsrf(settings.text);
  const posted = await request(app)
    .post("/settings/api-keys")
    .redirects(0)
    .set("Cookie", cookie)
    .type("form")
    .send({ _csrf: csrf, "api-key-name": name });
  expect(posted.status).toBe(302);
  const shown = await request(app).get("/settings").set("Cookie", cookie);
  const match = shown.text.match(/data-testid="api-key-plaintext"[^>]*>([^<]+)</);
  expect(match?.[1]?.trim()).toBeTruthy();
  return match![1].trim();
}

describe("api keys", () => {
  it("creates a named key, shows plaintext once, hides it on reload", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    expect(page.text).toContain('data-testid="api-keys-section"');
    expect(page.text).not.toContain('data-testid="api-key-plaintext"');
    await createNamedKey(app, cookie, "script");
    const after = await request(app).get("/settings").set("Cookie", cookie);
    expect(after.text).toContain('data-testid="api-key-row"');
    expect(after.text).toContain("script");
    expect(after.text).toMatch(/data-testid="api-key-created"[^>]*>\d{4}-\d{2}-\d{2}</);
    expect(after.text).not.toContain('data-testid="api-key-plaintext"');
  });

  it("GET /api/items with Bearer secret returns 200 items without a cookie", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/items/new").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    const saved = await request(app)
      .post("/items")
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: csrf,
        url: "https://example.com/from-ui",
        title: "From UI",
        note: "",
        tags: "api",
      });
    expect(saved.status).toBe(302);
    const secret = await createNamedKey(app, cookie, "cli");
    const res = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((it: { title: string }) => it.title === "From UI")).toBe(true);
  });

  it("missing header or Bearer not-a-key returns exact 401 body", async () => {
    const app = makeTestApp();
    const missing = await request(app).get("/api/items");
    expect(missing.status).toBe(401);
    expect(missing.text).toBe('{"error":"unauthorized"}');
    const bad = await request(app).get("/api/items").set("Authorization", "Bearer not-a-key");
    expect(bad.status).toBe(401);
    expect(bad.text).toBe('{"error":"unauthorized"}');
  });

  it("cookie session GET /api/items still works", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app).get("/api/items").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("count");
  });

  it("revoke is immediate and last used is recorded after a Bearer call", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const secret = await createNamedKey(app, cookie, "live");
    const ok = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(ok.status).toBe(200);
    const used = await request(app).get("/settings").set("Cookie", cookie);
    expect(used.text).toMatch(/data-testid="api-key-last-used"[^>]*>\d{4}-\d{2}-\d{2}</);
    const revokeCsrf = extractCsrf(used.text);
    const idMatch = used.text.match(/action="\/settings\/api-keys\/(\d+)\/revoke"/);
    expect(idMatch?.[1]).toBeTruthy();
    await request(app)
      .post(`/settings/api-keys/${idMatch![1]}/revoke`)
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: revokeCsrf });
    const after = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(after.status).toBe(401);
    expect(after.text).toBe('{"error":"unauthorized"}');
  });

  it("listApiKeys is newest first and the secret has 32 bytes of entropy", async () => {
    const db = openDb(":memory:");
    migrate(db);
    ensureSeedUser(db, { username: "demo", password: "demo-pass-1234" });
    const user = findByUsername(db, "demo");
    expect(user).toBeTruthy();
    const first = createApiKey(db, user!.id, "older");
    const second = createApiKey(db, user!.id, "newer");
    const listed = listApiKeys(db, user!.id);
    expect(listed[0].name).toBe("newer");
    expect(listed[1].name).toBe("older");
    expect(second.plaintext.length).toBeGreaterThan(40);
    expect(first.plaintext.startsWith("smk_")).toBe(true);
  });

  it("rotate keeps id and name, retires the old secret, shows last rotated", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const oldSecret = await createNamedKey(app, cookie, "keep-name");
    const listed = await request(app).get("/settings").set("Cookie", cookie);
    expect(listed.text).toContain("keep-name");
    const idMatch = listed.text.match(/action="\/settings\/api-keys\/(\d+)\/rotate"/);
    expect(idMatch?.[1]).toBeTruthy();
    const id = idMatch![1];
    const csrf = extractCsrf(listed.text);
    await request(app)
      .post(`/settings/api-keys/${id}/rotate`)
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf });
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const match = shown.text.match(/data-testid="api-key-plaintext"[^>]*>([^<]+)</);
    const newSecret = match![1].trim();
    expect(newSecret).toBeTruthy();
    expect(newSecret).not.toBe(oldSecret);
    expect(shown.text).toContain("keep-name");
    expect(shown.text).toMatch(/data-testid="api-key-last-rotated"[^>]*>\d{4}-\d{2}-\d{2}</);
    const rows = shown.text.split('data-testid="api-key-row"');
    expect(rows.length - 1).toBe(1);
    const oldRes = await request(app).get("/api/items").set("Authorization", `Bearer ${oldSecret}`);
    expect(oldRes.status).toBe(401);
    expect(oldRes.text).toBe('{"error":"unauthorized"}');
    const newRes = await request(app).get("/api/items").set("Authorization", `Bearer ${newSecret}`);
    expect(newRes.status).toBe(200);
  });
});

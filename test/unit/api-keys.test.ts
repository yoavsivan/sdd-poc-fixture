import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApiKey, findActiveByTokenHash, listActiveKeys } from "../../src/api-keys/repo.ts";
import { hashSecret, mintSecret } from "../../src/api-keys/secret.ts";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import { createUser } from "../../src/users/repo.ts";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

function extractPlaintext(html: string): string {
  const m = html.match(/data-testid="api-key-plaintext"[^>]*>([^<]+)/);
  if (!m) throw new Error("extractPlaintext: api-key-plaintext not found");
  return m[1];
}

async function createNamedKey(
  app: ReturnType<typeof makeTestApp>,
  cookie: string,
  name: string,
): Promise<{ html: string; secret: string }> {
  const page = await request(app).get("/settings").set("Cookie", cookie);
  const csrf = extractCsrf(page.text);
  const posted = await request(app)
    .post("/settings/api-keys")
    .set("Cookie", cookie)
    .type("form")
    .redirects(0)
    .send({ _csrf: csrf, name });
  expect(posted.status).toBe(302);
  expect(posted.headers.location).toBe("/settings");
  const html = await request(app).get("/settings").set("Cookie", cookie);
  expect(html.status).toBe(200);
  return { html: html.text, secret: extractPlaintext(html.text) };
}

describe("api-keys secret", () => {
  it("mints a non-empty secret with 32-byte body and stable hash", () => {
    const minted = mintSecret();
    expect(minted.plaintext.startsWith(`smk_${minted.prefix}_`)).toBe(true);
    expect(minted.plaintext.length).toBeGreaterThan(40);
    const body = minted.plaintext.slice(`smk_${minted.prefix}_`.length);
    const decoded = Buffer.from(body, "base64url");
    expect(decoded.length).toBe(32);
    expect(hashSecret(minted.plaintext)).toBe(minted.tokenHash);
    expect(hashSecret(minted.plaintext)).not.toBe(hashSecret(minted.plaintext + "x"));
  });
});

describe("api-keys repo", () => {
  it("creates and lists newest first", () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, { username: "demo", password: "demo-pass-1234" });
    const a = createApiKey(db, user.id, "first");
    const b = createApiKey(db, user.id, "second");
    const list = listActiveKeys(db, user.id);
    expect(list.map((k) => k.name)).toEqual(["second", "first"]);
    expect(findActiveByTokenHash(db, hashSecret(a.plaintext))?.id).toBe(a.record.id);
    expect(findActiveByTokenHash(db, hashSecret(b.plaintext))?.id).toBe(b.record.id);
    db.close();
  });
});

describe("api-keys http", () => {
  it("creates a named key, shows plaintext once, lists name and created date", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const { html, secret } = await createNamedKey(app, cookie, "scripts");
    expect(secret.length).toBeGreaterThan(0);
    expect(html).toContain('data-testid="api-key-row"');
    expect(html).toContain("scripts");
    expect(html).toMatch(/data-testid="api-key-created">\d{4}-\d{2}-\d{2}</);
    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    expect(reload.text).toContain('data-testid="api-key-row"');
    expect(reload.text).toContain("scripts");
  });

  it("GET /api/items with Bearer and no cookie returns the UI-created item", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/items/new").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    const added = await request(app)
      .post("/items")
      .set("Cookie", cookie)
      .type("form")
      .redirects(0)
      .send({
        _csrf: csrf,
        url: "https://example.com/from-ui",
        title: "From UI",
        note: "",
        tags: "",
      });
    expect(added.status).toBe(302);
    const { secret } = await createNamedKey(app, cookie, "cli");
    const res = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((it: { title: string }) => it.title === "From UI")).toBe(
      true,
    );
    const withCookie = await request(app).get("/api/items").set("Cookie", cookie);
    expect(withCookie.status).toBe(200);
    const itemsPage = await request(app).get("/items").set("Cookie", cookie);
    expect(itemsPage.status).toBe(200);
    expect(itemsPage.text).toContain("item-row");
  });

  it("missing header and Bearer not-a-key return exact 401 body", async () => {
    const app = makeTestApp();
    const missing = await request(app).get("/api/items");
    expect(missing.status).toBe(401);
    expect(missing.text).toBe('{"error":"unauthorized"}');
    const bogus = await request(app).get("/api/items").set("Authorization", "Bearer not-a-key");
    expect(bogus.status).toBe(401);
    expect(bogus.text).toBe('{"error":"unauthorized"}');
    const cookie = await signInCookie(app);
    const both = await request(app)
      .get("/api/items")
      .set("Cookie", cookie)
      .set("Authorization", "Bearer not-a-key");
    expect(both.status).toBe(401);
    expect(both.text).toBe('{"error":"unauthorized"}');
  });

  it("shows last used after Bearer use and revoke is immediate", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const { secret, html: createdHtml } = await createNamedKey(app, cookie, "rotate-me");
    expect(createdHtml).not.toContain('data-testid="api-key-last-used"');
    const used = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(used.status).toBe(200);
    const afterUse = await request(app).get("/settings").set("Cookie", cookie);
    expect(afterUse.text).toMatch(/data-testid="api-key-last-used">\d{4}-\d{2}-\d{2}</);
    const csrf = extractCsrf(afterUse.text);
    const revoke = await request(app)
      .post("/settings/api-keys/1/revoke")
      .set("Cookie", cookie)
      .type("form")
      .redirects(0)
      .send({ _csrf: csrf });
    expect(revoke.status).toBe(302);
    const again = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(again.status).toBe(401);
    expect(again.text).toBe('{"error":"unauthorized"}');
    const listed = await request(app).get("/settings").set("Cookie", cookie);
    expect(listed.text).not.toContain('data-testid="api-key-row"');
  });
});

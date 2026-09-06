import { describe, expect, it } from "vitest";
import request from "supertest";
import { generateApiKeySecret, hashSecret } from "../../src/api-keys/secret.ts";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

function firstSid(header: string | string[] | undefined): string {
  const list = !header ? [] : Array.isArray(header) ? header : [header];
  const hit = list.find((c) => c.includes("shelfmark.sid="));
  if (!hit) throw new Error("missing session cookie");
  return hit.split(";")[0];
}

function testid(html: string, id: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`data-testid="${id}"[^>]*>([^<]*)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

async function createNamedKey(
  app: ReturnType<typeof makeTestApp>,
  cookie: string,
  name: string,
) {
  const page = await request(app).get("/settings").set("Cookie", cookie);
  const csrf = extractCsrf(page.text);
  const posted = await request(app)
    .post("/settings/api-keys")
    .redirects(0)
    .set("Cookie", cookie)
    .type("form")
    .send({ _csrf: csrf, api_key_name: name });
  expect(posted.status).toBe(302);
  const nextCookie = firstSid(posted.headers["set-cookie"]) || cookie;
  const shown = await request(app).get("/settings").set("Cookie", nextCookie);
  const plaintext = testid(shown.text, "api-key-plaintext")[0] || "";
  return { cookie: nextCookie, html: shown.text, plaintext };
}

describe("api-keys", () => {
  it("generated secret has a prefix and at least 32 random bytes of entropy", () => {
    const a = generateApiKeySecret();
    const b = generateApiKeySecret();
    expect(a.plaintext.startsWith("smk_")).toBe(true);
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.plaintext.length).toBeGreaterThan(40);
    expect(a.secretHash).toBe(hashSecret(a.plaintext));
    expect(a.secretHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("Settings create shows plaintext once; reload hides it; row lists name and created date", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await createNamedKey(app, cookie, "scripts");
    expect(created.plaintext.length).toBeGreaterThan(0);
    expect(created.html).toContain('data-testid="api-key-row"');
    expect(created.html).toContain("scripts");
    const createdAt = testid(created.html, "api-key-created")[0];
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const reload = await request(app).get("/settings").set("Cookie", created.cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    expect(reload.text).toContain('data-testid="api-key-row"');
  });

  it("GET /api/items with Bearer secret returns 200 items+count including a UI-created item", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const formPage = await request(app).get("/items/new").set("Cookie", cookie);
    const csrf = extractCsrf(formPage.text);
    const saved = await request(app)
      .post("/items")
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: csrf,
        url: "https://example.com/bearer-item",
        title: "Bearer listed",
        note: "",
        tags: "",
      });
    expect(saved.status).toBe(302);
    const created = await createNamedKey(app, cookie, "ci");
    const res = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${created.plaintext}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.count).toBe(res.body.items.length);
    expect(res.body.items.some((it: { title: string }) => it.title === "Bearer listed")).toBe(
      true,
    );
  });

  it('missing header or Bearer not-a-key returns 401 {"error":"unauthorized"}', async () => {
    const app = makeTestApp();
    const missing = await request(app).get("/api/items");
    expect(missing.status).toBe(401);
    expect(missing.text).toBe('{"error":"unauthorized"}');
    const bogus = await request(app)
      .get("/api/items")
      .set("Authorization", "Bearer not-a-key");
    expect(bogus.status).toBe(401);
    expect(bogus.text).toBe('{"error":"unauthorized"}');
  });

  it("bogus Bearer does not fall back to a valid cookie", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app)
      .get("/api/items")
      .set("Cookie", cookie)
      .set("Authorization", "Bearer not-a-key");
    expect(res.status).toBe(401);
    expect(res.text).toBe('{"error":"unauthorized"}');
  });

  it("cookie sessions still work on GET /api/items and /items", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const api = await request(app).get("/api/items").set("Cookie", cookie);
    expect(api.status).toBe(200);
    expect(api.body).toHaveProperty("items");
    expect(api.body).toHaveProperty("count");
    const page = await request(app).get("/items").set("Cookie", cookie);
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/item-row|items-empty/);
  });

  it("after use, last used is shown; revoke makes the secret 401 immediately", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await createNamedKey(app, cookie, "rotate-me");
    const used = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${created.plaintext}`);
    expect(used.status).toBe(200);
    const afterUse = await request(app).get("/settings").set("Cookie", created.cookie);
    const lastUsed = testid(afterUse.text, "api-key-last-used")[0];
    expect(lastUsed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const csrf = extractCsrf(afterUse.text);
    const revokeMatch = afterUse.text.match(
      /action="\/settings\/api-keys\/(\d+)\/revoke"/,
    );
    expect(revokeMatch).toBeTruthy();
    const revoked = await request(app)
      .post(`/settings/api-keys/${revokeMatch![1]}/revoke`)
      .redirects(0)
      .set("Cookie", created.cookie)
      .type("form")
      .send({ _csrf: csrf });
    expect(revoked.status).toBe(302);
    const again = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${created.plaintext}`);
    expect(again.status).toBe(401);
    expect(again.text).toBe('{"error":"unauthorized"}');
  });
});

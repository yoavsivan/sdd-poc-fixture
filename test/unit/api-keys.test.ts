import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

function plaintextFrom(html: string): string {
  const m = html.match(/data-testid="api-key-plaintext"[^>]*>[\s\S]*?<code>([^<]+)<\/code>/);
  if (!m) throw new Error("plaintextFrom: api-key-plaintext not found");
  return m[1].trim();
}

describe("api-keys", () => {
  it("creates a named key, shows plaintext once, then hides it", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    expect(page.status).toBe(200);
    expect(page.text).toContain("data-testid=\"api-keys-section\"");
    const csrf = extractCsrf(page.text);
    const created = await request(app)
      .post("/settings/api-keys")
      .set("Cookie", cookie)
      .redirects(0)
      .type("form")
      .send({ _csrf: csrf, name: "scripts" });
    expect(created.status).toBe(302);
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    expect(shown.status).toBe(200);
    const secret = plaintextFrom(shown.text);
    expect(secret.length).toBeGreaterThan(8);
    expect(shown.text).toContain("data-testid=\"api-key-row\"");
    expect(shown.text).toMatch(/data-testid="api-key-created">\d{4}-\d{2}-\d{2}</);
    const again = await request(app).get("/settings").set("Cookie", cookie);
    expect(again.text).not.toContain("data-testid=\"api-key-plaintext\"");
  });

  it("GET /api/items with Bearer secret and no cookie returns 200 items+count", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({ url: "https://example.com/from-ui", title: "From UI", note: "n" });
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    await request(app)
      .post("/settings/api-keys")
      .set("Cookie", cookie)
      .redirects(0)
      .type("form")
      .send({ _csrf: csrf, name: "cli" });
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const secret = plaintextFrom(shown.text);
    const res = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.items.some((it: { title: string }) => it.title === "From UI")).toBe(true);
  });

  it('missing header or Bearer not-a-key returns 401 {"error":"unauthorized"}', async () => {
    const app = makeTestApp();
    const missing = await request(app).get("/api/items");
    expect(missing.status).toBe(401);
    expect(missing.text).toBe('{"error":"unauthorized"}');
    const bad = await request(app).get("/api/items").set("Authorization", "Bearer not-a-key");
    expect(bad.status).toBe(401);
    expect(bad.body).toEqual({ error: "unauthorized" });
    expect(bad.text).toBe('{"error":"unauthorized"}');
  });

  it("cookie sessions still work for GET /api/items", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app).get("/api/items").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("count");
  });

  it("shows last used after Bearer use and revoke is immediate", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    await request(app)
      .post("/settings/api-keys")
      .set("Cookie", cookie)
      .redirects(0)
      .type("form")
      .send({ _csrf: csrf, name: "rotate-me" });
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const secret = plaintextFrom(shown.text);
    const idMatch = shown.text.match(/action="\/settings\/api-keys\/(\d+)\/revoke"/);
    expect(idMatch).toBeTruthy();
    const id = idMatch![1];
    await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    const afterUse = await request(app).get("/settings").set("Cookie", cookie);
    expect(afterUse.text).toMatch(/data-testid="api-key-last-used">\d{4}-\d{2}-\d{2}</);
    const csrf2 = extractCsrf(afterUse.text);
    const revoked = await request(app)
      .post(`/settings/api-keys/${id}/revoke`)
      .set("Cookie", cookie)
      .redirects(0)
      .type("form")
      .send({ _csrf: csrf2 });
    expect(revoked.status).toBe(302);
    const denied = await request(app).get("/api/items").set("Authorization", `Bearer ${secret}`);
    expect(denied.status).toBe(401);
    expect(denied.text).toBe('{"error":"unauthorized"}');
  });

  it("rotate keeps id and name, retires old secret, shows last rotated", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    await request(app)
      .post("/settings/api-keys")
      .set("Cookie", cookie)
      .redirects(0)
      .type("form")
      .send({ _csrf: csrf, name: "keep-me" });
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const oldSecret = plaintextFrom(shown.text);
    const idMatch = shown.text.match(/action="\/settings\/api-keys\/(\d+)\/rotate"/);
    expect(idMatch).toBeTruthy();
    const id = idMatch![1];
    const csrf2 = extractCsrf(shown.text);
    const rotated = await request(app)
      .post(`/settings/api-keys/${id}/rotate`)
      .set("Cookie", cookie)
      .redirects(0)
      .type("form")
      .send({ _csrf: csrf2 });
    expect(rotated.status).toBe(302);
    const after = await request(app).get("/settings").set("Cookie", cookie);
    const newSecret = plaintextFrom(after.text);
    expect(newSecret).not.toBe(oldSecret);
    expect(after.text).toContain("keep-me");
    expect(after.text).toMatch(/data-testid="api-key-last-rotated">\d{4}-\d{2}-\d{2}</);
    const rows = after.text.split('data-testid="api-key-row"');
    expect(rows.length).toBe(2);
    const oldDenied = await request(app).get("/api/items").set("Authorization", `Bearer ${oldSecret}`);
    expect(oldDenied.status).toBe(401);
    expect(oldDenied.text).toBe('{"error":"unauthorized"}');
    const fresh = await request(app).get("/api/items").set("Authorization", `Bearer ${newSecret}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body).toHaveProperty("items");
  });
});

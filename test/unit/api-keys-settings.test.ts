import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

function extractPlaintext(html: string): string | null {
  const match = html.match(/data-testid="api-key-plaintext"[^>]*>([^<]+)</);
  return match ? match[1].trim() : null;
}

describe("api-keys-settings", () => {
  it("GET /settings includes API keys section, name field, and create button", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app).get("/settings").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain('data-testid="api-keys-section"');
    expect(res.text).toContain('data-testid="api-key-name"');
    expect(res.text).toContain('data-testid="api-key-create"');
    expect(res.text).toMatch(/API keys/);
    expect(res.text).toMatch(/shown once/i);
    expect(res.text).toMatch(/revoke is immediate/i);
  });

  it("create shows plaintext once; reload hides it and keeps the row", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    const created = await request(app)
      .post("/settings/api-keys")
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf, name: "scripts" });
    expect(created.status).toBe(302);
    expect(created.headers.location).toBe("/settings");
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    expect(shown.status).toBe(200);
    expect(shown.text).toContain('data-testid="api-key-row"');
    expect(shown.text).toContain("scripts");
    expect(shown.text).toContain('data-testid="api-key-created"');
    expect(shown.text).toMatch(/data-testid="api-key-created">\d{4}-\d{2}-\d{2}</);
    const secret = extractPlaintext(shown.text);
    expect(secret).toBeTruthy();
    expect(secret && secret.length).toBeGreaterThan(0);
    const reload = await request(app).get("/settings").set("Cookie", cookie);
    expect(reload.text).not.toContain('data-testid="api-key-plaintext"');
    expect(reload.text).toContain('data-testid="api-key-row"');
    expect(reload.text).not.toContain(secret as string);
    expect(reload.text).toContain("••••");
  });

  it("after Bearer use, last used is shown; revoke then 401", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    await request(app)
      .post("/settings/api-keys")
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf, name: "ci" });
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const secret = extractPlaintext(shown.text);
    expect(secret).toBeTruthy();
    const api = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${secret}`);
    expect(api.status).toBe(200);
    const afterUse = await request(app).get("/settings").set("Cookie", cookie);
    expect(afterUse.text).toMatch(/data-testid="api-key-last-used">\d{4}-\d{2}-\d{2}</);
    const revokePage = afterUse.text;
    const revokeCsrf = extractCsrf(revokePage);
    const revokeMatch = revokePage.match(/action="(\/settings\/api-keys\/\d+\/revoke)"/);
    expect(revokeMatch).toBeTruthy();
    const revoked = await request(app)
      .post(revokeMatch![1])
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: revokeCsrf });
    expect(revoked.status).toBe(302);
    const denied = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${secret}`);
    expect(denied.status).toBe(401);
    expect(denied.text).toBe('{"error":"unauthorized"}');
  });

  it("rotate keeps one row, shows new secret once, retires the old secret", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    await request(app)
      .post("/settings/api-keys")
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: csrf, name: "scripts" });
    const shown = await request(app).get("/settings").set("Cookie", cookie);
    const oldSecret = extractPlaintext(shown.text);
    expect(oldSecret).toBeTruthy();
    const rotateMatch = shown.text.match(/action="(\/settings\/api-keys\/\d+\/rotate)"/);
    expect(rotateMatch).toBeTruthy();
    const rotateCsrf = extractCsrf(shown.text);
    const rotated = await request(app)
      .post(rotateMatch![1])
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({ _csrf: rotateCsrf });
    expect(rotated.status).toBe(302);
    const after = await request(app).get("/settings").set("Cookie", cookie);
    const newSecret = extractPlaintext(after.text);
    expect(newSecret).toBeTruthy();
    expect(newSecret).not.toBe(oldSecret);
    expect(after.text).toContain("scripts");
    expect(after.text).toMatch(/data-testid="api-key-last-rotated">\d{4}-\d{2}-\d{2}</);
    expect(after.text.match(/data-testid="api-key-row"/g)?.length).toBe(1);
    const oldDenied = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${oldSecret}`);
    expect(oldDenied.status).toBe(401);
    expect(oldDenied.text).toBe('{"error":"unauthorized"}');
    const ok = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${newSecret}`);
    expect(ok.status).toBe(200);
  });
});

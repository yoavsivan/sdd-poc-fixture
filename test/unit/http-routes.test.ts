import { describe, expect, it } from "vitest";
import request from "supertest";
import { loadConfig } from "../../src/config.ts";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import { ensureSeedUser } from "../../src/db/seed.ts";
import { createApp } from "../../src/http/app.ts";
import { MemoryStore } from "../../src/http/middleware/session.ts";
import { createLogger } from "../../src/logger.ts";
import { createUser } from "../../src/users/repo.ts";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

describe("http-routes", () => {
  it("GET /api/items/:id as owner → 200 ItemResponse", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        url: "https://example.com/owned",
        title: "Owned",
        note: "n",
        tags: ["later"],
      });
    expect(created.status).toBe(201);
    const id = created.body.id as number;
    const res = await request(app).get(`/api/items/${id}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      url: "https://example.com/owned",
      title: "Owned",
      note: "n",
      tags: ["later"],
    });
    expect(typeof res.body.createdAt).toBe("string");
    expect(typeof res.body.updatedAt).toBe("string");
  });

  it('GET /api/items/:id for another user\'s item → 404 {"error":"not_found"}', async () => {
    const db = openDb(":memory:");
    migrate(db);
    ensureSeedUser(db, { username: "demo", password: "demo-pass-1234" });
    createUser(db, { username: "other", password: "other-pass-1234" });
    const app = createApp({
      db,
      config: loadConfig({
        NODE_ENV: "test",
        SESSION_SECRET: "test-session-secret-not-default",
        DATABASE_PATH: ":memory:",
        LOG_LEVEL: "error",
      }),
      store: new MemoryStore({ sweepIntervalMs: 0 }),
      logger: createLogger("error"),
    });
    const demoCookie = await signInCookie(app);
    const created = await request(app)
      .post("/api/items")
      .set("Cookie", demoCookie)
      .set("Content-Type", "application/json")
      .send({ url: "https://example.com/demo-only", title: "Demo only" });
    const id = created.body.id as number;
    const otherCookie = await signInCookie(app, {
      username: "other",
      password: "other-pass-1234",
    });
    const res = await request(app).get(`/api/items/${id}`).set("Cookie", otherCookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });

  it('GET /api/items/:id unknown id → 404 {"error":"not_found"}', async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app).get("/api/items/999999").set("Cookie", cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });

  it("DELETE /api/items/:id → 204, then the same DELETE again → 404", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({ url: "https://example.com/gone", title: "Gone" });
    const id = created.body.id as number;
    const first = await request(app).delete(`/api/items/${id}`).set("Cookie", cookie);
    expect(first.status).toBe(204);
    const second = await request(app).delete(`/api/items/${id}`).set("Cookie", cookie);
    expect(second.status).toBe(404);
    expect(second.body).toEqual({ error: "not_found" });
  });

  it("POST /settings/password with wrong current password → 400 re-render", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    const res = await request(app)
      .post("/settings/password")
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: csrf,
        current: "wrong-password",
        next: "brand-new-pass",
        confirm: "brand-new-pass",
      });
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/Current password is not correct/);
    expect(res.text).toMatch(/settings-password/);
  });

  it("POST /settings/password valid change → 302 /settings, then new password signs in", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/settings").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    const changed = await request(app)
      .post("/settings/password")
      .redirects(0)
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: csrf,
        current: "demo-pass-1234",
        next: "brand-new-pass",
        confirm: "brand-new-pass",
      });
    expect(changed.status).toBe(302);
    expect(changed.headers.location).toBe("/settings");
    const fresh = await signInCookie(app, { username: "demo", password: "brand-new-pass" });
    expect(fresh.startsWith("shelfmark.sid=")).toBe(true);
    const old = await request(app).get("/signin");
    const oldCsrf = extractCsrf(old.text);
    const oldCookie = (old.headers["set-cookie"] as string[]).find((c) =>
      c.startsWith("shelfmark.sid="),
    )!;
    const rejected = await request(app)
      .post("/signin")
      .redirects(0)
      .set("Cookie", oldCookie.split(";")[0])
      .type("form")
      .send({
        _csrf: oldCsrf,
        username: "demo",
        password: "demo-pass-1234",
      });
    expect(rejected.status).toBe(401);
  });

  it('POST /signin with bad credentials → 401 and body contains data-testid="signin-error"', async () => {
    const app = makeTestApp();
    const page = await request(app).get("/signin");
    const csrf = extractCsrf(page.text);
    const cookie = (page.headers["set-cookie"] as string[]).find((c) =>
      c.startsWith("shelfmark.sid="),
    )!;
    const res = await request(app)
      .post("/signin")
      .set("Cookie", cookie.split(";")[0])
      .type("form")
      .send({
        _csrf: csrf,
        username: "demo",
        password: "definitely-wrong",
      });
    expect(res.status).toBe(401);
    expect(res.text).toContain('data-testid="signin-error"');
  });
});

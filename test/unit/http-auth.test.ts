import { describe, expect, it } from "vitest";
import request from "supertest";
import type Database from "better-sqlite3";
import { createApiKey } from "../../src/apikeys/repo.ts";
import { findByUsername } from "../../src/users/repo.ts";
import { makeTestApp } from "../helpers/app.ts";
import { extractCsrf, signInCookie } from "../helpers/cookie.ts";

function sid(header: string | string[] | undefined): string {
  const list = !header ? [] : Array.isArray(header) ? header : [header];
  const hit = list.find((c) => c.includes("shelfmark.sid="));
  if (!hit) return "";
  return hit;
}

describe("http-auth", () => {
  it("every route sets a session cookie", async () => {
    const app = makeTestApp();
    const paths = ["/signin", "/items", "/settings", "/api/items", "/healthz", "/no-such-page"];
    for (const path of paths) {
      const res = await request(app).get(path);
      expect(sid(res.headers["set-cookie"]), path).toMatch(/shelfmark\.sid=/);
    }
  });

  it("GET /items with tampered cookie → 302 /signin", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
    const res = await request(app).get("/items").set("Cookie", tampered).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/signin\?next=/);
  });

  it('GET /api/items with tampered cookie → 401 {"error":"unauthorized"}', async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
    const res = await request(app).get("/api/items").set("Cookie", tampered);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  it("GET /api/items with no cookie → 401 exact body", async () => {
    const app = makeTestApp();
    const res = await request(app).get("/api/items");
    expect(res.status).toBe(401);
    expect(res.text).toBe('{"error":"unauthorized"}');
  });

  it("GET /api/items with 'Authorization: Bearer anything' and no cookie → 401", async () => {
    const app = makeTestApp();
    const res = await request(app).get("/api/items").set("Authorization", "Bearer anything");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  it('POST /api/items with invalid url → 400 {"error":"invalid","fields":{"url":…}}', async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({ url: "not-a-url", title: "Nope" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid");
    expect(res.body.fields.url).toBeTruthy();
  });

  it("POST /api/items with form content-type → 415", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .type("form")
      .send({ url: "https://example.com", title: "Form" });
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: "unsupported_media_type" });
  });

  it("POST /items without _csrf → 403", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/items/new").set("Cookie", cookie);
    expect(extractCsrf(page.text)).toBeTruthy();
    const res = await request(app)
      .post("/items")
      .set("Cookie", cookie)
      .type("form")
      .send({ url: "https://example.com", title: "No token" });
    expect(res.status).toBe(403);
    expect(res.text).toMatch(/could not be submitted/i);
  });

  it("GET /api/items with valid Bearer and no cookie → 200 items and count", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const created = await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({ url: "https://example.com/from-ui", title: "From the UI" });
    expect(created.status).toBe(201);
    const db = app.locals.db as Database.Database;
    const user = findByUsername(db, "demo");
    if (!user) throw new Error("seed user missing");
    const key = createApiKey(db, user.id, "scripts");
    const res = await request(app)
      .get("/api/items")
      .set("Authorization", `Bearer ${key.plaintext}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.count).toBe(res.body.items.length);
    expect(res.body.items.some((item: { title: string }) => item.title === "From the UI")).toBe(
      true,
    );
  });

  it('GET /api/items with Authorization Bearer not-a-key → 401 {"error":"unauthorized"}', async () => {
    const app = makeTestApp();
    const res = await request(app).get("/api/items").set("Authorization", "Bearer not-a-key");
    expect(res.status).toBe(401);
    expect(res.text).toBe('{"error":"unauthorized"}');
  });

  it("GET /api/items with cookie and no Bearer still returns 200", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    await request(app)
      .post("/api/items")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({ url: "https://example.com/cookie", title: "Cookie item" });
    const res = await request(app).get("/api/items").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("GET /items with cookie still renders item-row", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const page = await request(app).get("/items/new").set("Cookie", cookie);
    const csrf = extractCsrf(page.text);
    await request(app)
      .post("/items")
      .set("Cookie", cookie)
      .type("form")
      .send({
        _csrf: csrf,
        url: "https://example.com/row",
        title: "Row item",
        note: "",
        tags: "",
      });
    const list = await request(app).get("/items").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.text).toContain('data-testid="item-row"');
  });
});

import { describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../helpers/app.ts";
import { signInCookie } from "../helpers/cookie.ts";

describe("views", () => {
  it("GET /settings (signed in) renders settings-nav, settings-account, settings-password, settings-api-usage", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app).get("/settings").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain('data-testid="settings-nav"');
    expect(res.text).toContain('data-testid="settings-account"');
    expect(res.text).toContain('data-testid="settings-password"');
    expect(res.text).toContain('data-testid="settings-api-usage"');
    expect(res.text).toContain('data-testid="api-keys-section"');
    expect(res.text).toContain('data-testid="api-key-name"');
    expect(res.text).toContain('data-testid="api-key-create"');
  });

  it("GET /items?q=<no-match-suffix> (signed in) renders items-empty", async () => {
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const res = await request(app).get("/items?q=zzznomatchsuffix").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain('data-testid="items-empty"');
  });
});

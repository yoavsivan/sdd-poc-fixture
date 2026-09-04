import type express from "express";
import request from "supertest";

function firstSidCookie(header: string | string[] | undefined): string | undefined {
  if (!header) return undefined;
  const list = Array.isArray(header) ? header : [header];
  for (const item of list) {
    const pair = item.split(";")[0];
    if (pair.startsWith("shelfmark.sid=")) return pair;
  }
  return undefined;
}

/** Pull the hidden `_csrf` field out of an HTML page. */
export function extractCsrf(html: string): string {
  const a = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (a) return a[1];
  const b = html.match(/value="([^"]+)"\s+name="_csrf"/);
  if (b) return b[1];
  throw new Error("extractCsrf: hidden _csrf field not found");
}

/**
 * Sign in through the HTML form and return `shelfmark.sid=<signed>`.
 * Defaults to the seed user. Throws when the response is not a 302.
 */
export async function signInCookie(
  app: express.Express,
  creds: { username: string; password: string } = {
    username: "demo",
    password: "demo-pass-1234",
  },
): Promise<string> {
  const page = await request(app).get("/signin");
  const csrf = extractCsrf(page.text);
  const incoming = firstSidCookie(page.headers["set-cookie"]);
  if (!incoming) throw new Error("signInCookie: GET /signin did not set shelfmark.sid");
  const posted = await request(app)
    .post("/signin")
    .redirects(0)
    .set("Cookie", incoming)
    .type("form")
    .send({
      _csrf: csrf,
      username: creds.username,
      password: creds.password,
      next: "/items",
    });
  if (posted.status !== 302) {
    throw new Error(`signInCookie: expected 302, got ${posted.status}`);
  }
  const sid = firstSidCookie(posted.headers["set-cookie"]) ?? incoming;
  return sid;
}

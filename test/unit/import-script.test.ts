import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { makeTestApp } from "../helpers/app.ts";
import { signInCookie } from "../helpers/cookie.ts";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const importScript = path.join(repoRoot, "scripts/import.sh");
const sample = path.join(repoRoot, "scripts/sample-import.jsonl");

function requireBin(name: string): void {
  const fromPath = process.env.PATH || "";
  if (!fromPath) throw new Error(`${name} required: PATH is empty`);
}

async function listen(app: ReturnType<typeof makeTestApp>): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("listen: no port");
  return { server, url: `http://127.0.0.1:${addr.port}` };
}

const servers: http.Server[] = [];

afterEach(async () => {
  while (servers.length) {
    const s = servers.pop();
    if (!s) break;
    await new Promise<void>((resolve, reject) => s.close((err) => (err ? reject(err) : resolve())));
  }
});

describe("import-script", () => {
  it("with a valid cookie imports 3 rows → GET /api/items?tag=reading returns count 3", async () => {
    requireBin("bash");
    requireBin("curl");
    const app = makeTestApp();
    const cookie = await signInCookie(app);
    const { server, url } = await listen(app);
    servers.push(server);
    const result = await execFileAsync("bash", [importScript, sample], {
      env: { ...process.env, SHELFMARK_URL: url, SHELFMARK_COOKIE: cookie },
    });
    expect(result.stdout).toMatch(/imported 3 items \(0 failed\)/);
    const listed = await request(app).get("/api/items?tag=reading").set("Cookie", cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.count).toBe(3);
    const titles = (listed.body.items as { title: string }[]).map((i) => i.title).sort();
    expect(titles).toEqual(
      ["How a shelf remembers order", "Reading by lamplight", "Slow pages worth finishing"].sort(),
    );
  });

  it("without SHELFMARK_COOKIE → exit 2 and usage on stderr", async () => {
    requireBin("bash");
    try {
      await execFileAsync("bash", [importScript, sample], {
        env: { ...process.env, SHELFMARK_COOKIE: "" },
      });
      throw new Error("expected import.sh to fail");
    } catch (err) {
      const e = err as { code?: number; stderr?: string };
      expect(e.code).toBe(2);
      expect(String(e.stderr)).toMatch(/SHELFMARK_COOKIE/);
    }
  });

  it("with a bogus cookie → exit 1 and fail  401 on stdout", async () => {
    requireBin("bash");
    requireBin("curl");
    const app = makeTestApp();
    const { server, url } = await listen(app);
    servers.push(server);
    try {
      await execFileAsync("bash", [importScript, sample], {
        env: {
          ...process.env,
          SHELFMARK_URL: url,
          SHELFMARK_COOKIE: "shelfmark.sid=bogus",
        },
      });
      throw new Error("expected import.sh to fail");
    } catch (err) {
      const e = err as { code?: number; stdout?: string };
      expect(e.code).toBe(1);
      expect(String(e.stdout)).toMatch(/fail  401/);
      expect(String(e.stdout)).toMatch(/imported 0 items \(3 failed\)/);
    }
  });
});

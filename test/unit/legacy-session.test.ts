import { afterEach, describe, expect, it } from "vitest";
import legacySession from "../../src/legacy/session.cjs";

const { signCookie, unsignCookie, parseCookies, MemoryStore, createSessionMiddleware } =
  legacySession;

describe("legacy-session", () => {
  const secret = "unit-test-secret";
  const stores: InstanceType<typeof MemoryStore>[] = [];

  afterEach(() => {
    for (const s of stores) s.stop();
    stores.length = 0;
  });

  it("sign/unsign roundtrip", () => {
    const sid = "abc123def456";
    const signed = signCookie(sid, secret);
    expect(signed.startsWith(sid + ".")).toBe(true);
    expect(unsignCookie(signed, secret)).toBe(sid);
  });

  it("unsign rejects tampered signature (returns null)", () => {
    const signed = signCookie("abc123def456", secret);
    const tampered = signed.slice(0, -1) + (signed.endsWith("a") ? "b" : "a");
    expect(unsignCookie(tampered, secret)).toBeNull();
  });

  it("unsign rejects malformed input", () => {
    expect(unsignCookie("", secret)).toBeNull();
    expect(unsignCookie("no-dot-here", secret)).toBeNull();
    expect(unsignCookie(".onlysig", secret)).toBeNull();
    expect(unsignCookie("value.", secret)).toBeNull();
    expect(unsignCookie("value.sig", "")).toBeNull();
  });

  it("store.set/get/destroy callbacks", async () => {
    const store = new MemoryStore({ sweepIntervalMs: 0 });
    stores.push(store);
    await new Promise<void>((resolve, reject) => {
      store.set("s1", { userId: 7, flash: ["hi"] }, 60_000, (err) => {
        if (err) return reject(err);
        store.get("s1", (e2, data) => {
          if (e2) return reject(e2);
          expect(data).toEqual({ userId: 7, flash: ["hi"] });
          store.destroy("s1", (e3) => {
            if (e3) return reject(e3);
            store.get("s1", (e4, missing) => {
              if (e4) return reject(e4);
              expect(missing).toBeUndefined();
              resolve();
            });
          });
        });
      });
    });
  });

  it("sweep removes expired entries and returns the count", async () => {
    const store = new MemoryStore({ sweepIntervalMs: 0 });
    stores.push(store);
    await new Promise<void>((resolve, reject) => {
      store.set("old", { userId: 1 }, 10, (err) => {
        if (err) return reject(err);
        store.set("fresh", { userId: 2 }, 60_000, (e2) => {
          if (e2) return reject(e2);
          const removed = store.sweep(Date.now() + 50);
          expect(removed).toBe(1);
          store.get("fresh", (e3, data) => {
            if (e3) return reject(e3);
            expect(data?.userId).toBe(2);
            store.get("old", (e4, missing) => {
              if (e4) return reject(e4);
              expect(missing).toBeUndefined();
              resolve();
            });
          });
        });
      });
    });
  });

  it("middleware issues new session + replaces cookie when signature invalid", async () => {
    const mw = createSessionMiddleware({ secret, cookieName: "shelfmark.sid" });
    const req = {
      headers: { cookie: "shelfmark.sid=not-a-valid-signature" },
    } as { headers: { cookie: string }; session?: { id: string; isNew: boolean } };
    const headers: Record<string, string | string[]> = {};
    const res = {
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
      setHeader(name: string, value: string | string[]) {
        headers[name.toLowerCase()] = value;
      },
      end() {},
    };
    await new Promise<void>((resolve, reject) => {
      mw(req, res, (err?: unknown) => {
        if (err) return reject(err);
        expect(req.session).toBeTruthy();
        expect(req.session?.isNew).toBe(true);
        (req.session as { save: (cb: (e: Error | null) => void) => void }).save((e2) => {
          if (e2) return reject(e2);
          const setCookie = headers["set-cookie"];
          const raw = Array.isArray(setCookie) ? setCookie.join("\n") : String(setCookie || "");
          expect(raw.includes("shelfmark.sid=")).toBe(true);
          expect(raw.includes("not-a-valid-signature")).toBe(false);
          resolve();
        });
      });
    });
  });
});

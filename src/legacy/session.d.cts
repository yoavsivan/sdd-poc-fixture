/**
 * Hand-written types for the CommonJS legacy session module.
 * Runtime lives in session.cjs and is not compiled.
 *
 * unsignCookie returns null on tamper or format error (constant-time compare).
 * Missing cookies mint a new session; a bad signature replaces the cookie.
 */

export interface SessionData {
  userId?: number;
  csrf?: string;
  flash?: string[];
  /** One-time API key plaintext; cleared after the next Settings render. */
  apiKeyPlaintext?: string;
}

export interface SessionStore {
  get(
    sid: string,
    cb: (err: Error | null, data?: SessionData, expiresAt?: number) => void,
  ): void;
  set(sid: string, data: SessionData, ttlMs: number, cb: (err: Error | null) => void): void;
  destroy(sid: string, cb: (err: Error | null) => void): void;
  /** Returns the number of expired entries removed. */
  sweep(now?: number): number;
}

export declare class MemoryStore implements SessionStore {
  constructor(opts?: { sweepIntervalMs?: number });
  get(
    sid: string,
    cb: (err: Error | null, data?: SessionData, expiresAt?: number) => void,
  ): void;
  set(sid: string, data: SessionData, ttlMs: number, cb: (err: Error | null) => void): void;
  destroy(sid: string, cb: (err: Error | null) => void): void;
  sweep(now?: number): number;
  size(): number;
  stop(): void;
}

export interface Session {
  id: string;
  data: SessionData;
  isNew: boolean;
  destroyed?: boolean;
  save(cb: (err: Error | null) => void): void;
  regenerate(cb: (err: Error | null) => void): void;
  destroy(cb: (err: Error | null) => void): void;
}

export interface SessionOptions {
  secret: string;
  cookieName?: string;
  maxAgeMs?: number;
  secure?: boolean;
  store?: SessionStore;
}

export function createSessionMiddleware(
  opts: SessionOptions,
): (req: any, res: any, next: (err?: any) => void) => void;

/** Returns "<value>.<base64url hmac-sha256>". */
export function signCookie(value: string, secret: string): string;

/** Returns the value, or null on tamper / malformed input. */
export function unsignCookie(signed: string, secret: string): string | null;

export function parseCookies(header: string | undefined): Record<string, string>;

declare const legacySession: {
  createSessionMiddleware: typeof createSessionMiddleware;
  signCookie: typeof signCookie;
  unsignCookie: typeof unsignCookie;
  parseCookies: typeof parseCookies;
  MemoryStore: typeof MemoryStore;
};

export default legacySession;

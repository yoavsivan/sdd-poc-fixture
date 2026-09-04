import crypto from "node:crypto";

const PREFIX = "scrypt";
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;

function toHex(buf: Buffer): string {
  return buf.toString("hex");
}

function fromHex(hex: string): Buffer | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

/**
 * Hash a password as `scrypt$N$salt$hash` using Node's scrypt.
 */
export function hashPassword(plain: string): string {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("hashPassword: password must be a non-empty string");
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(plain, salt, KEYLEN, { N, r, p });
  return `${PREFIX}$${N}$${toHex(salt)}$${toHex(hash)}`;
}

/**
 * Verify a password against a `scrypt$N$salt$hash` stored string.
 * Returns false for a wrong password or a malformed stored value.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  if (typeof plain !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [kind, nRaw, saltHex, hashHex] = parts;
  if (kind !== PREFIX) return false;
  const n = Number.parseInt(nRaw, 10);
  if (!Number.isInteger(n) || n < 2) return false;
  const salt = fromHex(saltHex);
  const expected = fromHex(hashHex);
  if (!salt || !expected) return false;
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(plain, salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

import crypto from "node:crypto";

const PREFIX_BYTES = 4;
const SECRET_BYTES = 32;

export interface MintedSecret {
  plaintext: string;
  prefix: string;
  suffix: string;
  tokenHash: string;
}

/**
 * SHA-256 hex of the full plaintext secret. Used as the lookup key.
 */
export function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/**
 * Mint a bearer secret: 32 random bytes (base64url body) plus an 8-hex prefix.
 */
export function mintSecret(): MintedSecret {
  const prefix = crypto.randomBytes(PREFIX_BYTES).toString("hex");
  const body = crypto.randomBytes(SECRET_BYTES).toString("base64url");
  const plaintext = `smk_${prefix}_${body}`;
  const suffix = plaintext.slice(-4);
  return {
    plaintext,
    prefix,
    suffix,
    tokenHash: hashSecret(plaintext),
  };
}

export function maskSecret(prefix: string, suffix: string): string {
  return `smk_${prefix}_••••${suffix}`;
}

/** UTC calendar date `YYYY-MM-DD` from an ISO-8601 timestamp. */
export function utcDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

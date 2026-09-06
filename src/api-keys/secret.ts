import crypto from "node:crypto";

const DISPLAY_PREFIX = "smk";
const RANDOM_BYTES = 32;
const PREFIX_HEX_LEN = 8;

export interface GeneratedApiKey {
  plaintext: string;
  prefix: string;
  last4: string;
  hash: string;
}

/**
 * SHA-256 hex digest of a bearer secret. Used as the lookup key.
 */
export function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/**
 * Mint a named-key secret: short prefix plus at least 32 random bytes, encoded.
 * Format: `smk_<8-hex-prefix>_<base64url(32 bytes)>`.
 */
export function generateApiKeySecret(): GeneratedApiKey {
  const prefix = crypto.randomBytes(4).toString("hex");
  if (prefix.length !== PREFIX_HEX_LEN) {
    throw new Error("generateApiKeySecret: prefix length mismatch");
  }
  const secretPart = crypto.randomBytes(RANDOM_BYTES).toString("base64url");
  const plaintext = `${DISPLAY_PREFIX}_${prefix}_${secretPart}`;
  const last4 = plaintext.slice(-4);
  return {
    plaintext,
    prefix,
    last4,
    hash: hashSecret(plaintext),
  };
}

/**
 * Calendar date (UTC) for UI timestamps: YYYY-MM-DD.
 */
export function utcDateStamp(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 10) return null;
  return iso.slice(0, 10);
}

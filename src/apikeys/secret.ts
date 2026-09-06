import crypto from "node:crypto";

const KIND = "smk";
const SECRET_BYTES = 32;

/**
 * SHA-256 hex digest of a bearer secret. Used as the stored lookup key.
 */
export function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export interface MintedSecret {
  plaintext: string;
  prefix: string;
  last4: string;
  secretHash: string;
}

/**
 * Mint a bearer secret: short prefix plus ≥32 random bytes, base64url-encoded.
 * Format: `smk_<8 hex>_<body>`.
 */
export function mintApiKeySecret(): MintedSecret {
  const prefix = `${KIND}_${crypto.randomBytes(4).toString("hex")}`;
  const body = crypto.randomBytes(SECRET_BYTES).toString("base64url");
  const plaintext = `${prefix}_${body}`;
  return {
    plaintext,
    prefix,
    last4: plaintext.slice(-4),
    secretHash: hashSecret(plaintext),
  };
}

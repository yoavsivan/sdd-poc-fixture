import crypto from "node:crypto";

const PREFIX_LEN = 8;
const TAIL_LEN = 4;
const RANDOM_BYTES = 32;

/**
 * Mint a bearer secret: `smk_` plus base64url of 32 random bytes.
 */
export function mintPlaintext(): string {
  const body = crypto.randomBytes(RANDOM_BYTES).toString("base64url");
  return `smk_${body}`;
}

export function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function displayPrefix(plaintext: string): string {
  return plaintext.slice(0, PREFIX_LEN);
}

export function maskedTail(plaintext: string): string {
  if (plaintext.length <= TAIL_LEN) return plaintext;
  return plaintext.slice(-TAIL_LEN);
}

export function maskSecret(prefix: string, tailHint?: string): string {
  const tail = tailHint && tailHint.length > 0 ? tailHint : "••••";
  return `${prefix}…${tail}`;
}

/** UTC ISO datetime → `YYYY-MM-DD` for the UI. */
export function uiDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

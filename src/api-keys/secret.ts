import crypto from "node:crypto";

const PREFIX_TAG = "smk_";
const PREFIX_RANDOM_BYTES = 4;
const SECRET_BYTES = 32;
const TAIL_LEN = 4;

export function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function generateApiKeySecret(): {
  plaintext: string;
  prefix: string;
  tail: string;
  secretHash: string;
} {
  const prefix = PREFIX_TAG + crypto.randomBytes(PREFIX_RANDOM_BYTES).toString("hex");
  const body = crypto.randomBytes(SECRET_BYTES).toString("base64url");
  const plaintext = prefix + body;
  return {
    plaintext,
    prefix,
    tail: plaintext.slice(-TAIL_LEN),
    secretHash: hashSecret(plaintext),
  };
}

export function maskApiKey(prefix: string, tail: string): string {
  return `${prefix}••••${tail}`;
}

/** UTC instant stored as ISO-8601; UI shows the date part only. */
export function isoDateUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

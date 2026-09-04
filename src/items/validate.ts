export type FieldErrors = Record<string, string>;

const MAX_URL = 2048;
const MAX_TITLE = 200;
const MAX_NOTE = 2000;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function looksLikeHttpUrl(raw: string): boolean {
  if (raw.length === 0 || raw.length > MAX_URL) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

export interface RawItemFields {
  url?: unknown;
  title?: unknown;
  note?: unknown;
}

/**
 * Shared field rules for the item form and POST /api/items.
 * Tag shape is checked separately by normalizeTags.
 */
export function validateItemFields(input: RawItemFields): {
  values: { url: string; title: string; note: string };
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const url = asString(input.url).trim();
  const title = asString(input.title).trim();
  const note = asString(input.note);

  if (!url) {
    errors.url = "URL is required";
  } else if (url.length > MAX_URL) {
    errors.url = `URL must be at most ${MAX_URL} characters`;
  } else if (!looksLikeHttpUrl(url)) {
    errors.url = "URL must be an http or https address";
  }

  if (!title) {
    errors.title = "Title is required";
  } else if (title.length > MAX_TITLE) {
    errors.title = `Title must be at most ${MAX_TITLE} characters`;
  }

  if (note.length > MAX_NOTE) {
    errors.note = `Note must be at most ${MAX_NOTE} characters`;
  }

  return {
    values: { url, title, note },
    errors,
  };
}

/** True when the error map has at least one field. */
export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

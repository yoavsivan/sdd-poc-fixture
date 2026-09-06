/**
 * Format a stored UTC ISO timestamp as YYYY-MM-DD for the UI.
 */
export function isoDateUtc(value: string | null | undefined): string {
  if (!value) return "";
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

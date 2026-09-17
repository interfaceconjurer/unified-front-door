/** Relative legacy labels and timezone-less values have no provable instant. */
export function displayTimestamp(value: string): { dateTime: string; label: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  const normalized = new Date(value).toISOString();
  return { dateTime: normalized, label: `${normalized.slice(0, 10)} ${normalized.slice(11, 16)} UTC` };
}

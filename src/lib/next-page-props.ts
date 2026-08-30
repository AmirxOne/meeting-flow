export type NextSearchParams = Record<string, string | string[] | undefined>;

/** First string value of a Next.js searchParams entry (string | string[]). */
export function queryParam(sp: NextSearchParams, key: string): string | null {
  const v = sp[key];
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

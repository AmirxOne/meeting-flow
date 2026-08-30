/** Build absolute public check-in URL for a guest code. */
export function buildCheckinUrl(code: string, origin?: string): string {
  const normalized = code.trim().toUpperCase();
  let base = origin?.replace(/\/$/, "") ?? "";
  if (!base && typeof window !== "undefined") {
    base = window.location.origin;
  }
  return `${base}/checkin/${normalized}`;
}

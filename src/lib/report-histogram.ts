/** Always 8–20 (and any earlier/later hours that actually have meetings). */
export function fillHourlyHistogram(
  hourMap: Map<number, number>,
  officeStart = 8,
  officeEnd = 20,
): { hour: number; count: number }[] {
  const used = [...hourMap.keys()];
  const start = used.length ? Math.min(officeStart, ...used) : officeStart;
  const end = used.length ? Math.max(officeEnd, ...used) : officeEnd;
  const out: { hour: number; count: number }[] = [];
  for (let hour = start; hour <= end; hour += 1) {
    out.push({ hour, count: hourMap.get(hour) ?? 0 });
  }
  return out;
}

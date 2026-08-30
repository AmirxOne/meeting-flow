/** Validation + normalization for org policy defaultReminderOffsets (minutes before meeting). */

export const REMINDER_OFFSET_MAX_COUNT = 12;
export const REMINDER_OFFSET_MAX_MINUTES = 7 * 24 * 60; // one week

export type ReminderOffsetsValidation =
  | { ok: true; offsets: number[] }
  | { ok: false; error: string };

/** Validate offsets: positive integers, unique, sorted descending (larger first). */
export function validateReminderOffsets(raw: unknown): ReminderOffsetsValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "یادآورها باید لیستی از اعداد باشد" };
  }
  if (raw.length > REMINDER_OFFSET_MAX_COUNT) {
    return { ok: false, error: `حداکثر ${REMINDER_OFFSET_MAX_COUNT} یادآور مجاز است` };
  }

  const parsed: number[] = [];
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isFinite(item) || !Number.isInteger(item)) {
      return { ok: false, error: "هر یادآور باید عدد صحیح باشد" };
    }
    if (item <= 0) {
      return { ok: false, error: "هر یادآور باید عدد مثبت باشد" };
    }
    if (item > REMINDER_OFFSET_MAX_MINUTES) {
      return { ok: false, error: "حداکثر فاصله یادآور یک هفته (۱۰۰۸۰ دقیقه) است" };
    }
    parsed.push(item);
  }

  const unique = [...new Set(parsed)];
  if (unique.length !== parsed.length) {
    return { ok: false, error: "یادآورهای تکراری مجاز نیستند" };
  }

  const offsets = unique.sort((a, b) => b - a);
  return { ok: true, offsets };
}

export function coerceReminderOffsets(raw: unknown, fallback: number[]): number[] {
  const result = validateReminderOffsets(raw);
  return result.ok ? result.offsets : [...fallback];
}

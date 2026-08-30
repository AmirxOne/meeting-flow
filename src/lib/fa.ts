// Persian digit conversion + number formatting (display only — never store).
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function faNum(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function faStr(text: string): string {
  return text.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

const EN_FROM_FA: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/** Convert Persian/Arabic-Indic digits to ASCII — for input values before store/API. */
export function toEnDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => EN_FROM_FA[d] ?? d);
}

const RLM = "\u200F";

/** Keep Latin/digit runs pinned to the right edge of an RTL input. */
export function withRtlMark(text: string): string {
  if (!text) return text;
  return text.startsWith(RLM) ? text : RLM + text;
}

export function stripBidiMarks(text: string): string {
  return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

export function faPad2(n: number): string {
  return faNum(n < 10 ? `0${n}` : String(n));
}

export function faInt(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

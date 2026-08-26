// Persian digit conversion + number formatting (display only — never store).
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function faNum(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function faStr(text: string): string {
  return text.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function faPad2(n: number): string {
  return faNum(n < 10 ? `0${n}` : String(n));
}

export function faInt(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

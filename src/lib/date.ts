const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = parseDateKey(value);
  return toDateKey(d) === value;
}

/** 端末のローカル日付で YYYY-MM-DD を返す（UTCにすると深夜に日付がずれる）。 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 例: 2026年10月22日（木） */
export function formatDateJa(key: string): string {
  const d = parseDateKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** URLハッシュ（#2026-10-22）から日付を読む。不正なら null。 */
export function dateFromHash(hash: string): string | null {
  const key = hash.replace(/^#/, "");
  return isDateKey(key) ? key : null;
}

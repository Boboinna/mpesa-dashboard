// Formatting and date helpers. All dates are ISO strings ("2024-12-30");
// everything is plain string/UTC math so the browser's timezone never matters.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 126050 -> "1,260.50" */
export function amount(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${group(Math.floor(abs / 100))}.${pad(abs % 100)}`;
}

/** 126050 -> "KES 1,260.50" */
export function kes(cents: number): string {
  return `KES ${amount(cents)}`;
}

/** 126050 -> "KES 1,261" (whole shillings, for cards and charts) */
export function kesWhole(cents: number): string {
  const w = Math.round(Math.abs(cents) / 100);
  return `${cents < 0 && w !== 0 ? "-" : ""}KES ${group(w)}`;
}

/** 4286400 -> "+KES 42,864" / "-KES 42,864" */
export function kesSigned(cents: number): string {
  const w = Math.round(Math.abs(cents) / 100);
  return `${cents < 0 ? "-" : "+"}KES ${group(w)}`;
}

/** Axis labels: 4286400 -> "43k", 125000000 -> "1.3M" */
export function compact(cents: number): string {
  const v = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${sign}${Math.round(v / 1_000)}k`;
  return `${sign}${Math.round(v)}`;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ---- dates -----------------------------------------------------------------

export function dayNum(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayNum(n: number): string {
  const dt = new Date(n * 86_400_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(iso: string, n: number): string {
  return fromDayNum(dayNum(iso) + n);
}

export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}

/** "2024-12-30" -> "30 Dec 2024" */
export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2024-12-30" -> "30 Dec" */
export function fmtDayShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "2024-12-30T16:02:20+03:00" -> "30 Dec 2024, 16:02" */
export function fmtDateTime(completedAt: string): string {
  return `${fmtDay(completedAt.slice(0, 10))}, ${completedAt.slice(11, 16)}`;
}

/** "2024-12" -> "Dec 2024" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2024-12" -> "Dec" */
export function monthShort(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

export function weekdayName(dow: number): string {
  return WEEKDAYS[dow];
}

export function fmtRange(from: string, to: string): string {
  return `${fmtDay(from)} – ${fmtDay(to)}`;
}

/** First and last day of a month ("2024-02" -> 2024-02-01, 2024-02-29). */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  return { from, to: addDays(addMonths(from, 1), -1) };
}

/** Monday of the week containing `day`, given its weekday (0 = Sunday). */
export function mondayOf(day: string, dow: number): string {
  return addDays(day, -((dow + 6) % 7));
}

/** Every month key from `from` to `to` inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = `${from.slice(0, 7)}-01`;
  const end = `${to.slice(0, 7)}-01`;
  while (cur <= end && out.length < 600) {
    out.push(cur.slice(0, 7));
    cur = addMonths(cur, 1);
  }
  return out;
}

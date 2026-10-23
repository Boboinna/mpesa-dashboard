// Small pure helpers: money, phone numbers, dates, details text.

/** "1,260.00" -> 126000, "-3.00" -> -300. No floating point. */
export function toCents(s: string): number {
  const t = s.replace(/,/g, "").trim();
  const neg = t.startsWith("-");
  const [whole = "0", frac = ""] = t.replace("-", "").split(".");
  const cents =
    parseInt(whole || "0", 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return neg ? -cents : cents;
}

export function isAmount(s: string): boolean {
  return /^-?[\d,]+\.\d{2}$/.test(s);
}

export function normalizeMsisdn(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return "254" + d;
  return null;
}

/** The full number is never stored or shown. */
export function maskedLabel(msisdn: string | null): string {
  if (!msisdn) return "Unknown number";
  const local = "0" + msisdn.slice(3);
  return local.slice(0, 4) + "***" + local.slice(-3);
}

/** Masked numbers in Details: "0797***410" -> "254797***410". */
export function normalizeMaskedPhone(p: string): string {
  if (/^0\d/.test(p)) return "254" + p.slice(1);
  return p.replace(/^\+/, "");
}

export function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Joins wrapped Details lines. A word split by a hyphen at the line end
 * ("H-" + "Fund") is glued back; "to -" + "254..." keeps its space.
 */
export function joinLines(lines: string[]): string {
  let out = "";
  for (const raw of lines) {
    const line = collapse(raw);
    if (!line) continue;
    if (!out) out = line;
    else out = /[A-Za-z0-9]-$/.test(out) ? out + line : out + " " + line;
  }
  return out;
}

export function titleCase(s: string): string {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s; // mixed case: leave
  return s
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}

export type TimeParts = {
  completedAt: string;
  day: string;
  month: string;
  dow: number;
  hour: number;
};

/** Statement times are Nairobi time (UTC+3). Pure string math, never the browser's timezone. */
export function timeParts(date: string, time: string): TimeParts {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    completedAt: `${date}T${time}+03:00`,
    day: date,
    month: date.slice(0, 7),
    dow,
    hour: parseInt(time.slice(0, 2), 10),
  };
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function toIso(d: string, mon: string, y: string): string | null {
  const m = MONTHS[mon.slice(0, 3).toLowerCase()];
  if (!m) return null;
  return `${y}-${m}-${d.padStart(2, "0")}`;
}

/** "01 Jan 2024 - 31 Dec 2024" -> { from: "2024-01-01", to: "2024-12-31" } */
export function parsePeriod(text: string): { from: string; to: string } | null {
  const m = text.match(
    /(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/,
  );
  if (!m) return null;
  const from = toIso(m[1], m[2], m[3]);
  const to = toIso(m[4], m[5], m[6]);
  return from && to ? { from, to } : null;
}

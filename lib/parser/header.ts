import type { Word } from "../types";
import { groupLines } from "./layout";
import { isAmount, normalizeMsisdn, parsePeriod, toCents } from "./normalize";

export type Header = {
  mobile: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  summary: { paidIn: number; paidOut: number } | null;
  declaredPages: number | null;
};

function lineTexts(words: Word[]) {
  return groupLines(words).map((l) => ({
    text: l.map((w) => w.text).join(" "),
    words: l,
  }));
}

/** True when page 1 looks like an M-Pesa statement. */
export function isMpesaStatement(words: Word[]): boolean {
  const hasTitle = lineTexts(words).some((l) => /M-PESA STATEMENT/i.test(l.text));
  const hasTable = words.some((w) => /^Receipt$/i.test(w.text));
  return hasTitle && hasTable;
}

/**
 * Reads the mobile number, statement period and the TOTAL line from page 1.
 * The customer name and email are deliberately NOT read.
 */
export function readHeader(words: Word[]): Header {
  const lines = lineTexts(words);
  let mobile: string | null = null;
  let periodFrom: string | null = null;
  let periodTo: string | null = null;
  let summary: Header["summary"] = null;
  let declaredPages: number | null = null;

  for (const l of lines) {
    const pg = l.text.match(/^Page\s+\d+\s+of\s+(\d+)$/i);
    if (pg && declaredPages === null) declaredPages = parseInt(pg[1], 10);
    let m = l.text.match(/^Mobile Number:?\s*(.*)$/i);
    if (m && !mobile) {
      const digits = m[1].match(/\+?\d[\d\s]{8,}\d/);
      mobile = digits ? normalizeMsisdn(digits[0]) : null;
      continue;
    }
    m = l.text.match(/^Statement Period:?\s*(.*)$/i);
    if (m && !periodFrom) {
      const p = parsePeriod(m[1]);
      if (p) {
        periodFrom = p.from;
        periodTo = p.to;
      }
      continue;
    }
    if (/^TOTAL:/i.test(l.text) && !summary) {
      const amounts = l.words.filter((w) => isAmount(w.text)).map((w) => toCents(w.text));
      if (amounts.length >= 2) summary = { paidIn: amounts[0], paidOut: amounts[1] };
    }
  }
  return { mobile, periodFrom, periodTo, summary, declaredPages };
}

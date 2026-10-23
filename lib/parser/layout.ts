import type { ParseWarning, RawRow, TextItem, Word } from "../types";
import { isAmount, joinLines, toCents } from "./normalize";

/** Splits pdf.js items into single words, estimating each word's horizontal position. */
export function toWords(items: TextItem[]): Word[] {
  const out: Word[] = [];
  for (const it of items) {
    const s = it.str;
    if (!s.trim()) continue;
    for (const m of s.matchAll(/\S+/g)) {
      const i = m.index ?? 0;
      out.push({
        text: m[0],
        x: it.x + (it.w * i) / s.length,
        x1: it.x + (it.w * (i + m[0].length)) / s.length,
        y: it.y,
      });
    }
  }
  return out;
}

/** Groups words into visual lines (top to bottom), each sorted left to right. */
export function groupLines(words: Word[], tol = 2.5): Word[][] {
  const sorted = [...words].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Word[][] = [];
  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - w.y) <= tol) last.push(w);
    else lines.push([w]);
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);
  return lines;
}

const RECEIPT = /^[A-Z0-9]{10}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}:\d{2}$/;

/**
 * Reads the transactions table on one page.
 *
 * Method (no fragile column geometry):
 *  1. The data region is everything below the "Receipt No." header line and
 *     above the "Disclaimer:" line. That removes page numbers, the disclaimer,
 *     the verification block and the footer in one step.
 *  2. A row starts at a 10-character receipt token at the far-left column.
 *  3. Every other word belongs to the nearest row start at or above it.
 *  4. In a row: date and time words, exactly two amount words (amount, then
 *     balance), and everything else is the wrapped Details text.
 */
export function extractPageRows(
  words: Word[],
  page: number,
  warnings: ParseWarning[],
): RawRow[] {
  const headers = words.filter((w) => /^Receipt$/i.test(w.text));
  if (headers.length === 0) return [];
  const header = headers.reduce((a, b) => (b.y < a.y ? b : a));
  const disclaimers = words.filter((w) => /^Disclaimer:?$/i.test(w.text));
  const endY = disclaimers.length ? Math.min(...disclaimers.map((w) => w.y)) : -Infinity;

  const data = words.filter((w) => w.y < header.y - 3 && w.y > endY + 1);
  const candidates = data.filter((w) => RECEIPT.test(w.text));
  if (candidates.length === 0) return [];
  const x0 = Math.min(...candidates.map((w) => w.x));
  const anchors = candidates.filter((w) => w.x <= x0 + 3).sort((a, b) => b.y - a.y);

  const buckets: Word[][] = anchors.map(() => []);
  for (const w of data) {
    if (anchors.includes(w)) continue;
    let idx = -1;
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i].y >= w.y - 2) idx = i;
      else break;
    }
    if (idx >= 0) buckets[idx].push(w);
    else warnings.push({ code: "ORPHAN_TEXT", message: `Unattached text "${w.text}"`, page });
  }

  const rows: RawRow[] = [];
  anchors.forEach((anchor, i) => {
    const ws = buckets[i];
    const date = ws.find((w) => DATE.test(w.text));
    const time = ws.find((w) => TIME.test(w.text));
    const amounts = ws.filter((w) => isAmount(w.text)).sort((a, b) => a.x - b.x);
    if (!date || !time || amounts.length !== 2) {
      warnings.push({
        code: "BAD_ROW",
        message: `Could not read row ${anchor.text} (date ${!!date}, time ${!!time}, amounts ${amounts.length})`,
        receiptNo: anchor.text,
        page,
      });
      return;
    }
    const textWords = ws
      .filter((w) => w !== date && w !== time && !isAmount(w.text) && w.text !== "Completed")
      .map((w) =>
        // A status glued to the end of Details ("HFundCompleted") is split off.
        w.text.endsWith("Completed") ? { ...w, text: w.text.slice(0, -"Completed".length) } : w,
      )
      .filter((w) => w.text.length > 0);
    const lines = groupLines(textWords).map((l) => l.map((w) => w.text).join(" "));
    rows.push({
      receiptNo: anchor.text,
      date: date.text,
      time: time.text,
      details: joinLines(lines),
      amount: toCents(amounts[0].text),
      balance: toCents(amounts[1].text),
      page,
    });
  });
  return rows;
}

/** Reads every page. Rows come back in statement order (newest first). */
export function extractRows(pages: TextItem[][]): { rows: RawRow[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const rows: RawRow[] = [];
  pages.forEach((items, i) => {
    rows.push(...extractPageRows(toWords(items), i + 1, warnings));
  });
  return { rows, warnings };
}

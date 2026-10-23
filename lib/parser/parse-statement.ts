import type { ParsedTransaction, ParseResult, ParseWarning, TextItem } from "../types";
import { ParseError } from "../types";
import { classify } from "./classify";
import { isMpesaStatement, readHeader } from "./header";
import { extractRows, toWords } from "./layout";
import { maskedLabel, timeParts } from "./normalize";
import { checkSummary, orderRows, verificationOf } from "./verify";

/**
 * Pure entry point: positioned text of every page in, transactions out.
 * No pdf.js, no browser APIs, so it can be unit tested with plain arrays.
 */
export function parseStatement(pages: TextItem[][]): ParseResult {
  if (pages.length === 0 || pages[0].length === 0) {
    throw new ParseError("NO_TEXT", "The file has no readable text (it may be a scan).");
  }
  const first = toWords(pages[0]);
  if (!isMpesaStatement(first)) {
    throw new ParseError("NOT_MPESA", "This does not look like an M-Pesa statement.");
  }

  const header = readHeader(first);
  const warnings: ParseWarning[] = [];

  const extracted = extractRows(pages);
  warnings.push(...extracted.warnings);
  if (extracted.rows.length === 0) {
    throw new ParseError("NO_ROWS", "No transactions were found in this statement.");
  }

  const ordered = orderRows(extracted.rows);
  warnings.push(...ordered.warnings);

  const transactions: ParsedTransaction[] = [];
  const unknown = new Set<string>();
  for (const r of ordered.rows) {
    const t = timeParts(r.date, r.time);
    const c = classify(r.details, r.amount);
    if (!c.known) unknown.add(r.details);
    transactions.push({
      receiptNo: r.receiptNo,
      completedAt: t.completedAt,
      day: t.day,
      month: t.month,
      dow: t.dow,
      hour: t.hour,
      tie: r.tie,
      details: r.details,
      amount: r.amount,
      balance: r.balance,
      kind: c.kind,
      category: c.category,
      viaFuliza: c.viaFuliza,
      feeType: c.feeType,
      counterparty: c.counterparty,
      counterpartyKey: c.counterpartyKey,
    });
  }

  if (!header.mobile) {
    warnings.push({ code: "NO_MOBILE", message: "Mobile number not found in the header." });
  }
  if (!header.summary) {
    warnings.push({ code: "NO_SUMMARY", message: "No TOTAL line found to check against." });
  }
  const days = transactions.map((t) => t.day).sort();
  let periodFrom = header.periodFrom;
  let periodTo = header.periodTo;
  if (!periodFrom || !periodTo) {
    warnings.push({ code: "NO_PERIOD", message: "Statement period not found; using row dates." });
    periodFrom = days[0];
    periodTo = days[days.length - 1];
  }

  const incomplete = header.declaredPages !== null && header.declaredPages > pages.length;
  if (incomplete) {
    warnings.push({
      code: "INCOMPLETE_FILE",
      message: `The statement has ${header.declaredPages} pages but the file has only ${pages.length}.`,
    });
  }

  const summaryMatch = checkSummary(ordered.sums, header.summary);
  return {
    mobile: header.mobile,
    accountLabel: maskedLabel(header.mobile),
    periodFrom,
    periodTo,
    transactions,
    summary: header.summary,
    sums: ordered.sums,
    summaryMatch,
    verification: verificationOf(incomplete ? null : summaryMatch, ordered.gaps.length),
    gaps: ordered.gaps,
    reorderedGroups: ordered.reorderedGroups,
    unknownDetails: [...unknown].slice(0, 50),
    warnings,
    pages: pages.length,
    declaredPages: header.declaredPages,
    incomplete,
  };
}

// Shared types for the whole app. Money is ALWAYS integer cents.

export type Kind =
  | "income" // money received from people or businesses, agent deposits
  | "expense" // money spent
  | "fee" // Safaricom charges
  | "loan_in" // Fuliza advance, Hustler Fund loan disbursement
  | "loan_out" // Fuliza repayment, Hustler Fund loan repayment
  | "transfer"; // M-Shwari and Hustler savings moves (your own money)

export type Category =
  | "Received"
  | "Deposits"
  | "Send money"
  | "Buy goods"
  | "Bills"
  | "Withdrawals"
  | "Airtime and data"
  | "Other"
  | "Fees"
  | "Fuliza"
  | "Hustler Fund"
  | "M-Shwari";

export type FeeType = "paybill" | "withdrawal" | "send" | "fuliza" | "other";

/** One positioned piece of text from pdf.js (y grows upward). */
export type TextItem = { str: string; x: number; y: number; w: number };

/** One whitespace-free word with an estimated horizontal span. */
export type Word = { text: string; x: number; x1: number; y: number };

/** A row exactly as read from the statement table. */
export type RawRow = {
  receiptNo: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  details: string;
  amount: number; // signed cents (+ paid in, - withdrawn)
  balance: number; // cents
  page: number;
};

/** A row after same-timestamp ordering. tie: 0 = oldest within identical timestamp. */
export type OrderedRow = RawRow & { tie: number };

export type ParsedTransaction = {
  receiptNo: string;
  completedAt: string; // "2024-12-30T16:02:20+03:00"
  day: string; // "2024-12-30" (Nairobi time)
  month: string; // "2024-12"
  dow: number; // 0 = Sunday
  hour: number; // 0..23 Nairobi time
  tie: number;
  details: string;
  amount: number;
  balance: number;
  kind: Kind;
  category: Category;
  viaFuliza: boolean;
  feeType: FeeType | null;
  counterparty: string | null;
  counterpartyKey: string | null;
};

/** A stored transaction: parsed data plus identity. */
export type Transaction = ParsedTransaction & {
  id: string; // idempotency key
  accountId: string;
};

export type Account = { id: string; label: string; createdAt: string };

export type Verification = "verified" | "partial" | "unverified";

/** A place where the statement's own running balance jumps with no row to explain it. */
export type BalanceGap = {
  receiptNo: string;
  completedAt: string;
  amount: number; // cents; positive = money appeared, negative = money vanished
};

export type ParseWarningCode =
  | "BAD_ROW"
  | "ORPHAN_TEXT"
  | "LARGE_GROUP"
  | "NO_MOBILE"
  | "NO_PERIOD"
  | "NO_SUMMARY"
  | "INCOMPLETE_FILE";

export type ParseWarning = {
  code: ParseWarningCode;
  message: string;
  receiptNo?: string;
  page?: number;
};

export type ImportLog = {
  id: string;
  accountId: string;
  fileName: string;
  periodFrom: string;
  periodTo: string;
  read: number;
  added: number;
  skipped: number;
  verification: Verification;
  gaps: number;
  importedAt: string;
};

export type ParseResult = {
  mobile: string | null; // normalized 254XXXXXXXXX
  accountLabel: string; // e.g. "0112***926"
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;
  transactions: ParsedTransaction[]; // statement order, newest first
  summary: { paidIn: number; paidOut: number } | null; // from the TOTAL line
  sums: { paidIn: number; paidOut: number }; // from the parsed rows
  summaryMatch: boolean | null; // null when the statement has no summary
  verification: Verification;
  gaps: BalanceGap[];
  reorderedGroups: number;
  unknownDetails: string[]; // rows no rule recognised (for extending the rules)
  warnings: ParseWarning[];
  pages: number; // pages actually read
  declaredPages: number | null; // "Page 1 of N" printed on the statement
  incomplete: boolean; // fewer pages than the statement says it has
};

export type ParseErrorCode =
  | "NOT_PDF"
  | "PASSWORD_CANCELLED"
  | "NOT_MPESA"
  | "NO_TEXT"
  | "CORRUPT"
  | "NO_ROWS";

export class ParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ParseError";
    this.code = code;
  }
}

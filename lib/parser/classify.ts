import type { Category, FeeType, Kind } from "../types";
import { normalizeMaskedPhone, titleCase } from "./normalize";

export type Classification = {
  kind: Kind;
  category: Category;
  viaFuliza: boolean;
  feeType: FeeType | null;
  counterparty: string | null;
  counterpartyKey: string | null;
  known: boolean; // false = fell through to the sign-based fallback
};

type Rule = { test: RegExp; kind: Kind; category: Category };

// Order matters: first match wins. M-Shwari and loans come before generic
// "deposit"/"withdraw" rules so they are never mistaken for income or spending.
const RULES: Rule[] = [
  { test: /^OverDraft of Credit Party/i, kind: "loan_in", category: "Fuliza" },
  { test: /^OD Loan Repayment/i, kind: "loan_out", category: "Fuliza" },
  { test: /^Term Loan Disbursement/i, kind: "loan_in", category: "Hustler Fund" },
  { test: /^Term Loan Repayment/i, kind: "loan_out", category: "Hustler Fund" },
  { test: /^(Savings Contribution|HFund Savings)/i, kind: "transfer", category: "Hustler Fund" },
  { test: /^M-Shwari (Deposit|Withdraw)/i, kind: "transfer", category: "M-Shwari" },
];

const AFTER_FEES: Rule[] = [
  { test: /^(Funds received from|Business Payment from)/i, kind: "income", category: "Received" },
  { test: /^Deposit of Funds at Agent/i, kind: "income", category: "Deposits" },
  { test: /^Merchant Payment/i, kind: "expense", category: "Buy goods" },
  { test: /^(Customer Withdrawal|Withdraw)/i, kind: "expense", category: "Withdrawals" },
  { test: /^(Airtime Purchase|Buy Bundles)/i, kind: "expense", category: "Airtime and data" },
  { test: /^Pay Bill/i, kind: "expense", category: "Bills" },
  { test: /^Customer (Transfer|Payment to Small Business)/i, kind: "expense", category: "Send money" },
];

const FULIZA_FEE = /(interest|access fee|facility fee).*fuliza|fuliza.*(interest|access fee|facility fee)/i;

function feeTypeOf(details: string): FeeType {
  if (FULIZA_FEE.test(details)) return "fuliza";
  if (/^Pay Bill/i.test(details)) return "paybill";
  if (/^Withdrawal/i.test(details)) return "withdrawal";
  if (/Transfer of Funds/i.test(details)) return "send";
  return "other";
}

function clean(name: string): string {
  return titleCase(name.replace(/[\s.]+$/, "").trim());
}

type Cp = { name: string; key: string };

/** Pulls who the money went to / came from out of the Details text. */
export function extractCounterparty(details: string): Cp | null {
  let m: RegExpMatchArray | null;

  m = details.match(/^Funds received from\s*-?\s*(\S+)\s+(.+)$/i);
  if (m) return { name: clean(m[2]), key: "p:" + normalizeMaskedPhone(m[1]) };

  m = details.match(/^Customer Transfer(?: Fuliza MPesa)? to\s*-?\s*(\S+)\s+(.+)$/i);
  if (m) return { name: clean(m[2]), key: "p:" + normalizeMaskedPhone(m[1]) };

  m = details.match(/^Customer Payment to Small Business to\s*-?\s*(\S+)\s+(.+)$/i);
  if (m) return { name: clean(m[2]), key: "p:" + normalizeMaskedPhone(m[1]) };

  // Everything after "Acc." is the account number the user typed, so it is dropped.
  m = details.match(
    /^Pay Bill(?: Online)?(?: Fuliza M-Pesa)? to\s+(\d{3,8})\s*-?\s*(.+?)(?:\s+Acc\..*)?$/i,
  );
  if (m) return { name: clean(m[2]), key: "bill:" + m[1] };

  m = details.match(/^Merchant Payment(?: Online)? to\s+(\d+)\s*-?\s*(.+)$/i);
  if (m) return { name: clean(m[2]), key: "till:" + m[1] };

  m = details.match(
    /^Customer Withdrawal at Agent(?: Till)?(?: with Fuliza)?(?: to)?\s+(\d+)\s*-?\s*(.+)$/i,
  );
  if (m) return { name: clean(m[2]), key: "agent:" + m[1] };

  m = details.match(/^Deposit of Funds at Agent(?: Till)?\s+(\d+)\s*-?\s*(.+)$/i);
  if (m) return { name: clean(m[2]), key: "agent:" + m[1] };

  // "Original conversation ID ..." is dropped.
  m = details.match(/^Business Payment from\s+(\d+)\s*-?\s*(.+?)(?:\s+via API.*)?$/i);
  if (m) return { name: clean(m[2]), key: "biz:" + m[1] };

  return null;
}

export function classify(details: string, amount: number): Classification {
  const base = { viaFuliza: false, feeType: null, counterparty: null, counterpartyKey: null };

  for (const r of RULES) {
    if (r.test.test(details)) return { ...base, kind: r.kind, category: r.category, known: true };
  }

  if (FULIZA_FEE.test(details) && amount < 0) {
    return { ...base, kind: "fee", category: "Fees", feeType: "fuliza", known: true };
  }
  if (/charge$/i.test(details) && amount < 0) {
    return { ...base, kind: "fee", category: "Fees", feeType: feeTypeOf(details), known: true };
  }

  for (const r of AFTER_FEES) {
    if (r.test.test(details)) {
      const cp = extractCounterparty(details);
      return {
        kind: r.kind,
        category: r.category,
        viaFuliza: r.kind === "expense" && /fuliza/i.test(details),
        feeType: null,
        counterparty: cp?.name ?? null,
        counterpartyKey: cp?.key ?? null,
        known: true,
      };
    }
  }

  // Unknown wording: keep it, classify by sign, and let the test report flag it.
  return amount > 0
    ? { ...base, kind: "income", category: "Other", known: false }
    : { ...base, kind: "expense", category: "Other", known: false };
}

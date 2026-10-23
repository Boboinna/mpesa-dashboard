"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, addMonths } from "./format";
import type { Category, Transaction } from "./types";

// Filters live in the page address (?preset=3m&cat=Bills) so a refresh or a
// bookmark keeps them. We use replaceState, so the back button leaves the app
// instead of stepping through every filter change.

export type Preset = "1m" | "3m" | "1y" | "all" | "custom";
export type View = "overview" | "transactions";
export type Direction = "all" | "in" | "out";

export type Filters = {
  preset: Preset;
  from: string | null; // used when preset = "custom"
  to: string | null;
  dir: Direction;
  cats: Category[];
  cp: string | null; // counterpartyKey
  q: string;
  min: number | null; // KES
  max: number | null; // KES
};

export const DEFAULT_FILTERS: Filters = {
  preset: "all",
  from: null,
  to: null,
  dir: "all",
  cats: [],
  cp: null,
  q: "",
  min: null,
  max: null,
};

export const ALL_CATEGORIES: Category[] = [
  "Received", "Deposits", "Send money", "Buy goods", "Bills", "Withdrawals",
  "Airtime and data", "Other", "Fees", "Fuliza", "Hustler Fund", "M-Shwari",
];

const PRESETS: Preset[] = ["1m", "3m", "1y", "all", "custom"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function num(s: string | null): number | null {
  if (s === null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseQuery(search: string): { filters: Filters; view: View } {
  const p = new URLSearchParams(search);
  const preset = p.get("preset") as Preset | null;
  const from = p.get("from");
  const to = p.get("to");
  const dir = p.get("dir");
  const cats = (p.get("cat") ?? "")
    .split(",")
    .filter((c): c is Category => (ALL_CATEGORIES as string[]).includes(c));

  const hasCustom = !!from && DAY.test(from) && !!to && DAY.test(to);
  const filters: Filters = {
    preset: preset && PRESETS.includes(preset) ? (preset === "custom" && !hasCustom ? "all" : preset) : hasCustom ? "custom" : "all",
    from: hasCustom ? from : null,
    to: hasCustom ? to : null,
    dir: dir === "in" || dir === "out" ? dir : "all",
    cats,
    cp: p.get("cp") || null,
    q: p.get("q") ?? "",
    min: num(p.get("min")),
    max: num(p.get("max")),
  };
  return { filters, view: p.get("view") === "transactions" ? "transactions" : "overview" };
}

/** Only non-default values go into the address. */
export function toQuery(f: Filters, view: View): string {
  const p = new URLSearchParams();
  if (view !== "overview") p.set("view", view);
  if (f.preset !== "all") p.set("preset", f.preset);
  if (f.preset === "custom" && f.from && f.to) {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  if (f.dir !== "all") p.set("dir", f.dir);
  if (f.cats.length) p.set("cat", f.cats.join(","));
  if (f.cp) p.set("cp", f.cp);
  if (f.q) p.set("q", f.q);
  if (f.min !== null) p.set("min", String(f.min));
  if (f.max !== null) p.set("max", String(f.max));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type Bounds = { earliest: string | null; latest: string | null };

/** Presets are relative to the newest transaction (statements are historical), not to today. */
export function resolveRange(f: Filters, b: Bounds): { from: string | null; to: string | null } {
  if (f.preset === "custom") return { from: f.from, to: f.to };
  if (f.preset === "all" || !b.latest) return { from: null, to: null };
  const months = f.preset === "1m" ? 1 : f.preset === "3m" ? 3 : 12;
  return { from: addDays(addMonths(b.latest, -months), 1), to: b.latest };
}

export function applyFilters(txs: Transaction[], f: Filters, bounds: Bounds): Transaction[] {
  const { from, to } = resolveRange(f, bounds);
  const q = f.q.trim().toLowerCase();
  const min = f.min !== null ? Math.round(f.min * 100) : null;
  const max = f.max !== null ? Math.round(f.max * 100) : null;
  return txs.filter((t) => {
    if (from && t.day < from) return false;
    if (to && t.day > to) return false;
    if (f.dir === "in" && t.kind !== "income") return false;
    if (f.dir === "out" && t.kind !== "expense" && t.kind !== "fee") return false;
    if (f.cats.length && !f.cats.includes(t.category)) return false;
    if (f.cp && t.counterpartyKey !== f.cp) return false;
    const abs = Math.abs(t.amount);
    if (min !== null && abs < min) return false;
    if (max !== null && abs > max) return false;
    if (q) {
      const hay = `${t.details} ${t.receiptNo} ${t.counterparty ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function isDefault(f: Filters): boolean {
  return toQuery(f, "overview") === "";
}

type FiltersValue = {
  filters: Filters;
  view: View;
  set: (patch: Partial<Filters>) => void;
  reset: () => void;
  setView: (v: View) => void;
  hasActive: boolean;
};

const Ctx = createContext<FiltersValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ filters: Filters; view: View }>(() =>
    typeof window === "undefined"
      ? { filters: DEFAULT_FILTERS, view: "overview" }
      : parseQuery(window.location.search),
  );

  useEffect(() => {
    const url = window.location.pathname + toQuery(state.filters, state.view) + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [state]);

  const set = useCallback((patch: Partial<Filters>) => {
    setState((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
  }, []);
  const reset = useCallback(() => setState((s) => ({ ...s, filters: DEFAULT_FILTERS })), []);
  const setView = useCallback((view: View) => setState((s) => ({ ...s, view })), []);

  const value = useMemo<FiltersValue>(
    () => ({ filters: state.filters, view: state.view, set, reset, setView, hasActive: !isDefault(state.filters) }),
    [state, set, reset, setView],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters(): FiltersValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFilters must be used inside <FiltersProvider>");
  return v;
}

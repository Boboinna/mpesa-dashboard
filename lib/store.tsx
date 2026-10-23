"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  clearPrefs,
  deleteAccountData,
  deleteDatabase,
  getActivePref,
  getRemember,
  loadAll,
  requestPersistence,
  saveAll,
  saveImport,
  setActivePref,
  setRememberPref,
} from "./db";
import { computeCoverage, planImport, type Coverage, type ImportPlan } from "./merge";
import type { Account, BalanceGap, ImportLog, ParseResult, Transaction, Verification } from "./types";

// The in-memory store is the single source of truth. IndexedDB is a mirror
// (written only when "Remember on this device" is on).

type State = {
  ready: boolean;
  accounts: Account[];
  transactions: Transaction[]; // all accounts
  imports: ImportLog[];
  activeAccountId: string | null;
  remember: boolean;
  storageError: string | null;
};

type Action =
  | { type: "HYDRATED"; accounts: Account[]; transactions: Transaction[]; imports: ImportLog[]; remember: boolean }
  | { type: "IMPORTED"; plan: ImportPlan }
  | { type: "SET_ACTIVE"; id: string | null }
  | { type: "SET_REMEMBER"; on: boolean }
  | { type: "CLEARED_ACCOUNT"; id: string }
  | { type: "CLEARED_ALL" }
  | { type: "STORAGE_ERROR"; message: string | null };

const initial: State = {
  ready: false,
  accounts: [],
  transactions: [],
  imports: [],
  activeAccountId: null,
  remember: true,
  storageError: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATED": {
      const saved = getActivePref();
      const active =
        action.accounts.find((a) => a.id === saved)?.id ?? action.accounts[0]?.id ?? null;
      return {
        ...state,
        ready: true,
        accounts: action.accounts,
        transactions: action.transactions,
        imports: action.imports,
        activeAccountId: active,
        remember: action.remember,
      };
    }
    case "IMPORTED": {
      const { plan } = action;
      return {
        ...state,
        accounts: plan.newAccount ? [...state.accounts, plan.account] : state.accounts,
        transactions: plan.added.length ? [...state.transactions, ...plan.added] : state.transactions,
        imports: [...state.imports, plan.log],
        activeAccountId: plan.account.id,
      };
    }
    case "SET_ACTIVE":
      return { ...state, activeAccountId: action.id };
    case "SET_REMEMBER":
      return { ...state, remember: action.on };
    case "CLEARED_ACCOUNT": {
      const accounts = state.accounts.filter((a) => a.id !== action.id);
      return {
        ...state,
        accounts,
        transactions: state.transactions.filter((t) => t.accountId !== action.id),
        imports: state.imports.filter((i) => i.accountId !== action.id),
        activeAccountId: state.activeAccountId === action.id ? (accounts[0]?.id ?? null) : state.activeAccountId,
      };
    }
    case "CLEARED_ALL":
      return { ...initial, ready: true, remember: true };
    case "STORAGE_ERROR":
      return { ...state, storageError: action.message };
    default:
      return state;
  }
}

export type ImportOutcome = {
  accountId: string;
  accountLabel: string;
  newAccount: boolean;
  hadOtherAccounts: boolean;
  periodFrom: string;
  periodTo: string;
  read: number;
  added: number;
  skipped: number;
  verification: Verification;
  gaps: BalanceGap[];
  incomplete: boolean;
  declaredPages: number | null;
  pagesRead: number;
  coverage: Coverage;
  saved: boolean | null; // null = "Remember" is off, nothing was saved
};

type StoreValue = {
  state: State;
  activeAccount: Account | null;
  activeTransactions: Transaction[];
  coverage: Coverage;
  hasData: boolean;
  commitImport: (result: ParseResult, fileName: string) => Promise<ImportOutcome>;
  setRemember: (on: boolean) => Promise<void>;
  setActiveAccount: (id: string) => void;
  clearAccount: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

const Ctx = createContext<StoreValue | null>(null);

const STORAGE_MSG = "Couldn’t save on this device. Your data will be lost when you close this tab.";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load saved data (if any) once on start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remember = getRemember();
      if (!remember) {
        dispatch({ type: "HYDRATED", accounts: [], transactions: [], imports: [], remember });
        return;
      }
      try {
        const data = await loadAll();
        if (!cancelled) dispatch({ type: "HYDRATED", ...data, remember });
      } catch {
        if (cancelled) return;
        dispatch({ type: "HYDRATED", accounts: [], transactions: [], imports: [], remember });
        dispatch({ type: "STORAGE_ERROR", message: STORAGE_MSG });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.ready) setActivePref(state.activeAccountId);
  }, [state.ready, state.activeAccountId]);

  const commitImport = useCallback(async (result: ParseResult, fileName: string) => {
    const s = stateRef.current;
    const plan = await planImport({
      existingIds: new Set(s.transactions.map((t) => t.id)),
      accounts: s.accounts,
      result,
      fileName,
    });
    dispatch({ type: "IMPORTED", plan });

    let saved: boolean | null = null;
    if (s.remember) {
      try {
        await saveImport(plan.account, plan.added, plan.log);
        void requestPersistence();
        saved = true;
      } catch {
        saved = false;
        dispatch({ type: "STORAGE_ERROR", message: STORAGE_MSG });
      }
    }

    const logs = [...s.imports, plan.log].filter((i) => i.accountId === plan.account.id);
    return {
      accountId: plan.account.id,
      accountLabel: plan.account.label,
      newAccount: plan.newAccount,
      hadOtherAccounts: plan.hadOtherAccounts,
      periodFrom: result.periodFrom,
      periodTo: result.periodTo,
      read: plan.log.read,
      added: plan.added.length,
      skipped: plan.skipped,
      verification: result.verification,
      gaps: result.gaps,
      incomplete: result.incomplete,
      declaredPages: result.declaredPages,
      pagesRead: result.pages,
      coverage: computeCoverage(logs),
      saved,
    } satisfies ImportOutcome;
  }, []);

  const setRemember = useCallback(async (on: boolean) => {
    setRememberPref(on);
    dispatch({ type: "SET_REMEMBER", on });
    const s = stateRef.current;
    try {
      if (on) {
        if (s.transactions.length > 0 || s.accounts.length > 0) {
          await saveAll({ accounts: s.accounts, transactions: s.transactions, imports: s.imports });
          void requestPersistence();
        }
      } else {
        await deleteDatabase(); // switching off removes the saved copy, memory keeps working
      }
      dispatch({ type: "STORAGE_ERROR", message: null });
    } catch {
      dispatch({ type: "STORAGE_ERROR", message: STORAGE_MSG });
    }
  }, []);

  const setActiveAccount = useCallback((id: string) => dispatch({ type: "SET_ACTIVE", id }), []);

  const clearAccount = useCallback(async (id: string) => {
    dispatch({ type: "CLEARED_ACCOUNT", id });
    try {
      await deleteAccountData(id);
    } catch {
      // memory is already cleared; nothing more to do
    }
  }, []);

  const clearAll = useCallback(async () => {
    dispatch({ type: "CLEARED_ALL" });
    try {
      await deleteDatabase();
    } catch {
      // ignore
    }
    clearPrefs();
  }, []);

  const value = useMemo<StoreValue>(() => {
    const activeAccount = state.accounts.find((a) => a.id === state.activeAccountId) ?? null;
    const activeTransactions = state.transactions.filter((t) => t.accountId === state.activeAccountId);
    const coverage = computeCoverage(state.imports.filter((i) => i.accountId === state.activeAccountId));
    return {
      state,
      activeAccount,
      activeTransactions,
      coverage,
      hasData: state.transactions.length > 0,
      commitImport,
      setRemember,
      setActiveAccount,
      clearAccount,
      clearAll,
    };
  }, [state, commitImport, setRemember, setActiveAccount, clearAccount, clearAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

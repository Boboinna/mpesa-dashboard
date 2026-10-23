import Dexie, { type Table } from "dexie";
import type { Account, ImportLog, Transaction } from "./types";

// IndexedDB is only a mirror of the in-memory store (see store.tsx). The
// dashboard never reads from here directly.

class PesaDB extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  imports!: Table<ImportLog, string>;

  constructor() {
    super("pesa-lens");
    this.version(1).stores({
      accounts: "id",
      transactions: "id, accountId, [accountId+completedAt], category, counterpartyKey",
      imports: "id, accountId, importedAt",
    });
  }
}

let instance: PesaDB | null = null;
function db(): PesaDB {
  if (!instance) instance = new PesaDB();
  return instance;
}

export type StoredData = {
  accounts: Account[];
  transactions: Transaction[];
  imports: ImportLog[];
};

export async function loadAll(): Promise<StoredData> {
  const d = db();
  const [accounts, transactions, imports] = await Promise.all([
    d.accounts.toArray(),
    d.transactions.toArray(),
    d.imports.toArray(),
  ]);
  return { accounts, transactions, imports };
}

/** Saves the new rows of one import in a single transaction. Idempotent: same ids overwrite themselves. */
export async function saveImport(account: Account, added: Transaction[], log: ImportLog): Promise<void> {
  const d = db();
  await d.transaction("rw", d.accounts, d.transactions, d.imports, async () => {
    await d.accounts.put(account);
    if (added.length > 0) await d.transactions.bulkPut(added);
    await d.imports.put(log);
  });
}

/** Writes everything currently in memory (used when "Remember" is switched on). */
export async function saveAll(data: StoredData): Promise<void> {
  const d = db();
  await d.transaction("rw", d.accounts, d.transactions, d.imports, async () => {
    await d.accounts.bulkPut(data.accounts);
    await d.transactions.bulkPut(data.transactions);
    await d.imports.bulkPut(data.imports);
  });
}

export async function deleteAccountData(accountId: string): Promise<void> {
  const d = db();
  await d.transaction("rw", d.accounts, d.transactions, d.imports, async () => {
    await d.transactions.where("accountId").equals(accountId).delete();
    await d.imports.where("accountId").equals(accountId).delete();
    await d.accounts.delete(accountId);
  });
}

/**
 * Deletes the whole database. The shared instance is dropped first, so anything
 * that runs while the delete is in progress (for example a new upload right
 * after "Clear data") opens a fresh connection instead of a closing one.
 */
export async function deleteDatabase(): Promise<void> {
  const d = db();
  instance = null;
  await d.delete();
}

/** Asks the browser not to evict our data. Best effort, never blocks anything. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}

// ---- tiny preferences in localStorage --------------------------------------

const REMEMBER_KEY = "pesa-lens:remember";
const ACTIVE_KEY = "pesa-lens:active";

function ls(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Default is ON. */
export function getRemember(): boolean {
  return ls()?.getItem(REMEMBER_KEY) !== "0";
}

export function setRememberPref(on: boolean): void {
  try {
    ls()?.setItem(REMEMBER_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

export function getActivePref(): string | null {
  return ls()?.getItem(ACTIVE_KEY) ?? null;
}

export function setActivePref(id: string | null): void {
  try {
    if (id) ls()?.setItem(ACTIVE_KEY, id);
    else ls()?.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

/** Removes the saved preferences too (used by "Clear everything"). */
export function clearPrefs(): void {
  try {
    ls()?.removeItem(REMEMBER_KEY);
    ls()?.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

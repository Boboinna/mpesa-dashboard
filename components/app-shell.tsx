"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FiltersProvider, useFilters, type View } from "@/lib/filters";
import { StoreProvider, useStore } from "@/lib/store";
import { useImport } from "@/lib/use-import";
import { Button, Icon } from "./bits";
import { LogoMark } from "./logo";
import { ClearDataDialog } from "./clear-data-dialog";
import { Dashboard } from "./dashboard";
import { ImportSummaryDialog } from "./import-summary-dialog";
import { Modal } from "./modal";
import { PasswordDialog } from "./password-dialog";
import { TransactionsView } from "./transactions-table";
import { ProgressPanel, UploadScreen } from "./upload-screen";

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
];

function Shell() {
  const { state, hasData, setRemember, setActiveAccount } = useStore();
  const { view, setView, reset } = useFilters();
  const imp = useImport();
  const [clearOpen, setClearOpen] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  if (!state.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-mute" role="status">
        Loading…
      </div>
    );
  }

  const busy = imp.phase === "reading" || imp.phase === "saving" || imp.phase === "password";
  const openPicker = () => picker.current?.click();
  const toggleRemember = async () => {
    const on = !state.remember;
    await setRemember(on);
    if (on) toast.success("Saved on this device", { description: "You can clear it any time." });
    else toast.info("Saved copy deleted", { description: "Your data stays until you close this tab." });
  };

  return (
    <>
      <input
        ref={picker}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a statement PDF"
        data-testid="shell-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void imp.start(f);
          e.target.value = "";
        }}
      />

      {!hasData ? (
        <UploadScreen
          onFile={(f) => void imp.start(f)}
          phase={imp.phase}
          file={imp.file}
          progress={imp.progress}
          remember={state.remember}
          onRememberChange={(on) => void setRemember(on)}
        />
      ) : (
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:px-10">
              <span className="mr-4 flex items-center gap-2.5 text-lg font-bold">
                <LogoMark />
                Pesa Lens
              </span>
              <nav aria-label="Views" className="flex gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={view === t.id ? "page" : undefined}
                    onClick={() => setView(t.id)}
                    className={`min-h-10 rounded-lg px-3.5 text-[15px] ${
                      view === t.id ? "bg-brand-soft font-bold text-brand-deep" : "font-medium text-[#4b574f] hover:bg-chip"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
              <span className="flex-1" />
              {state.accounts.length > 1 ? (
                <select
                  aria-label="Mobile number"
                  className="min-h-10 rounded-[10px] border border-[#cbd3cc] bg-white px-3 text-sm font-semibold"
                  value={state.activeAccountId ?? ""}
                  onChange={(e) => setActiveAccount(e.target.value)}
                >
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              ) : (
                <span className="rounded-[10px] border border-[#cbd3cc] bg-white px-3 py-2 text-sm font-semibold">
                  {state.accounts[0]?.label}
                </span>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={state.remember}
                aria-label="Remember on this device"
                onClick={() => void toggleRemember()}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${
                  state.remember ? "bg-brand-soft text-brand-deep" : "bg-[#fff1de] text-[#8a4b00]"
                }`}
              >
                <Icon name={state.remember ? "check" : "alert"} size={14} />
                {state.remember ? "Saved on this device" : "Not saved: closing this tab clears your data"}
              </button>
              <Button className="!min-h-10" onClick={openPicker} disabled={busy}>
                <Icon name="plus" size={16} />
                Add statement
              </Button>
              <Button className="!min-h-10" onClick={() => setClearOpen(true)}>
                Clear data
              </Button>
            </div>
          </header>

          {state.storageError ? (
            <div role="alert" className="border-b border-[#f2c58b] bg-[#fff8ee] px-4 py-2.5 text-center text-sm sm:px-10">
              {state.storageError}
            </div>
          ) : null}

          <main>{view === "overview" ? <Dashboard /> : <TransactionsView />}</main>
        </div>
      )}

      <Modal open={hasData && (imp.phase === "reading" || imp.phase === "saving")} onClose={() => {}} dismissible={false} labelledBy="progress-title" maxWidth="max-w-[560px]">
        <h2 id="progress-title" className="mb-4 text-[22px] font-bold">Adding your statement</h2>
        <ProgressPanel file={imp.file} phase={imp.phase} progress={imp.progress} />
      </Modal>

      <PasswordDialog
        open={imp.phase === "password"}
        reason={imp.passwordReason}
        file={imp.file}
        onSubmit={imp.submitPassword}
        onCancel={imp.cancelPassword}
      />

      <ImportSummaryDialog
        outcome={imp.phase === "done" ? imp.outcome : null}
        onAddAnother={() => {
          imp.dismiss();
          openPicker();
        }}
        onClose={imp.dismiss}
      />

      <ClearDataDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onCleared={() => {
          reset();
          setView("overview");
          imp.dismiss();
        }}
      />
    </>
  );
}

export default function AppShell() {
  return (
    <StoreProvider>
      <FiltersProvider>
        <Shell />
      </FiltersProvider>
    </StoreProvider>
  );
}

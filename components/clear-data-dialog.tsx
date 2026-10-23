"use client";

import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Button, Icon } from "./bits";
import { Modal } from "./modal";

export function ClearDataDialog({
  open,
  onClose,
  onCleared,
}: {
  open: boolean;
  onClose: () => void;
  onCleared: () => void;
}) {
  const { state, activeAccount, clearAccount, clearAll } = useStore();
  const total = state.transactions.length;
  const accountRows = state.transactions.filter((t) => t.accountId === activeAccount?.id).length;
  const several = state.accounts.length > 1;

  // The store clears its memory the moment the action starts, so the screen is
  // reset right away; the toast waits until storage is really emptied.
  const finish = async (action: Promise<void>, title: string) => {
    onClose();
    onCleared();
    await action;
    toast.success(title, { description: "Everything was removed from this device." });
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="clear-title" maxWidth="max-w-[520px]">
      <div className="flex flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-[#fdecea] text-bad">
          <Icon name="trash" size={22} />
        </span>
        <h2 id="clear-title" className="text-[22px] font-bold leading-tight">
          {several ? "Clear data from this device?" : "Clear all data from this device?"}
        </h2>
        <p className="leading-relaxed">
          This permanently deletes {(several ? accountRows : total).toLocaleString("en-US")} transactions and your
          saved settings from this browser{several ? ` for ${activeAccount?.label}` : ""}.
        </p>
        <p className="leading-relaxed text-mute">
          Your PDF files are never stored, so there is nothing else to remove. This can’t be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          {several && activeAccount ? (
            <Button
              variant="danger"
              onClick={() => void finish(clearAccount(activeAccount.id), `Cleared ${activeAccount.label}`)}
            >
              Clear {activeAccount.label}
            </Button>
          ) : null}
          <Button
            variant="danger"
            onClick={() => void finish(clearAll(), "All data cleared")}
          >
            {several ? "Clear everything" : "Clear all data"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

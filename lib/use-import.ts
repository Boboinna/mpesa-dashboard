"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { parseStatement } from "./parser/parse-statement";
import { loadPdfJs, readStatement, type PasswordReason } from "./parser/pdf";
import { ParseError } from "./types";
import { useStore, type ImportOutcome } from "./store";

export type ImportPhase = "idle" | "reading" | "password" | "saving" | "done";

const MAX_BYTES = 40 * 1024 * 1024;

const ERRORS: Record<string, [string, string]> = {
  NOT_PDF: ["That file isn’t a PDF", "Please choose your M-Pesa statement PDF."],
  NOT_MPESA: ["This doesn’t look like an M-Pesa statement", "Download the full statement from Safaricom and try again."],
  NO_TEXT: ["We can’t read this file", "It looks like a scan or image. Request the PDF statement from Safaricom."],
  CORRUPT: ["The file is damaged", "Download it again and retry."],
  NO_ROWS: ["No transactions found", "The statement looks empty. Try a different date range."],
};

/**
 * Runs the whole upload: read the PDF (asking for the password if needed),
 * parse, merge into the store, and report every outcome with a toast.
 */
export function useImport() {
  const { commitImport, state } = useStore();
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [progress, setProgress] = useState({ page: 0, total: 0 });
  const [passwordReason, setPasswordReason] = useState<PasswordReason>("need");
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const resolver = useRef<((pw: string | null) => void) | null>(null);
  const busy = useRef(false);

  const start = useCallback(
    async (f: File) => {
      if (busy.current) return;
      if (f.size > MAX_BYTES) {
        toast.error("That file is too large", { description: "Statements are usually a few MB. Check you chose the right file." });
        return;
      }
      busy.current = true;
      setFile({ name: f.name, size: f.size });
      setProgress({ page: 0, total: 0 });
      setOutcome(null);
      setPhase("reading");
      let askedPassword = false;
      try {
        const pdfjs = await loadPdfJs();
        const pages = await readStatement(pdfjs, await f.arrayBuffer(), {
          onProgress: (page, total) => setProgress({ page, total }),
          onPassword: (reason) =>
            new Promise<string | null>((resolve) => {
              askedPassword = true;
              if (reason === "incorrect") {
                toast.error("Incorrect password", { description: "Try again, or cancel to pick another file." });
              }
              setPasswordReason(reason);
              setPhase("password");
              resolver.current = (pw) => {
                resolver.current = null;
                if (pw !== null) setPhase("reading");
                resolve(pw);
              };
            }),
        });
        if (askedPassword) toast.success("Statement unlocked", { description: "Reading your transactions now." });

        const result = parseStatement(pages);
        setPhase("saving");
        const o = await commitImport(result, f.name);
        setOutcome(o);
        setPhase("done");

        toast.success(`Added ${o.added.toLocaleString("en-US")} transactions`, { description: `From mobile ${o.accountLabel}.` });
        if (o.skipped > 0) {
          toast.info(`${o.skipped.toLocaleString("en-US")} duplicates skipped`, {
            description: "The same statement uploaded twice changes nothing.",
          });
        }
        if (o.newAccount && o.hadOtherAccounts) {
          toast.info(`New number detected: ${o.accountLabel}`, { description: "Added as a separate account." });
        }
        if (o.incomplete) {
          toast.warning("This file is incomplete", {
            description: `The statement has ${o.declaredPages} pages but the file has ${o.pagesRead}.`,
          });
        } else if (o.verification !== "verified") {
          toast.warning("Some totals didn’t verify", { description: "The numbers may be slightly off. Check the import summary." });
        }
        if (o.saved === true) toast.success("Saved on this device", { description: "You can clear it any time." });
        if (o.saved === false) toast.warning("Couldn’t save on this device", { description: "Your data will be lost when you close this tab." });
      } catch (e) {
        if (e instanceof ParseError && e.code === "PASSWORD_CANCELLED") {
          // The user chose to cancel: no error toast.
        } else if (e instanceof ParseError && ERRORS[e.code]) {
          toast.error(ERRORS[e.code][0], { description: ERRORS[e.code][1] });
        } else {
          toast.error("Something went wrong", { description: "Please try again." });
        }
        setPhase("idle");
        setFile(null);
      } finally {
        busy.current = false;
      }
    },
    [commitImport],
  );

  const submitPassword = useCallback((pw: string) => resolver.current?.(pw), []);
  const cancelPassword = useCallback(() => resolver.current?.(null), []);
  const dismiss = useCallback(() => {
    if (busy.current) return; // never interrupt a running import
    setPhase("idle");
    setFile(null);
    setOutcome(null);
  }, []);

  return {
    phase,
    file,
    progress,
    passwordReason,
    outcome,
    remember: state.remember,
    start,
    submitPassword,
    cancelPassword,
    dismiss,
  };
}

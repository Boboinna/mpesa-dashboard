import type * as PdfJsModule from "pdfjs-dist";
import type { TextItem } from "../types";
import { ParseError } from "../types";

export type PdfJs = typeof PdfJsModule;
export type PasswordReason = "need" | "incorrect";

export type ReadOptions = {
  /** Return the password, or null to cancel. Called again with "incorrect" on a wrong password. */
  onPassword?: (reason: PasswordReason) => Promise<string | null>;
  onProgress?: (page: number, total: number) => void;
};

/**
 * Loads pdf.js in the browser (client only) and points it at its worker file.
 * Call this from the upload flow, never at module top level.
 */
export async function loadPdfJs(): Promise<PdfJs> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}

function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  );
}

/**
 * Opens a statement PDF (asking for the password if needed) and returns the
 * positioned text of every page. The password is never stored.
 */
export async function readStatement(
  pdfjs: PdfJs,
  data: ArrayBuffer | Uint8Array,
  opts: ReadOptions = {},
): Promise<TextItem[][]> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!isPdf(bytes)) throw new ParseError("NOT_PDF", "That file is not a PDF.");

  // Always a plain Uint8Array copy (pdf.js rejects Node Buffers and detaches the buffer it is given).
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  let cancelled = false;
  task.onPassword = (update: unknown, reason: number) => {
    const send = update as (password: string) => void;
    const ask = opts.onPassword ?? (async () => null);
    const why: PasswordReason =
      reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "incorrect" : "need";
    void ask(why).then((pw) => {
      if (pw === null) {
        cancelled = true;
        void task.destroy();
      } else {
        send(pw);
      }
    });
  };

  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch {
    if (cancelled) throw new ParseError("PASSWORD_CANCELLED", "Password entry was cancelled.");
    throw new ParseError("CORRUPT", "The file could not be opened.");
  }

  try {
    const pages: TextItem[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const raw of content.items) {
        const it = raw as unknown as { str?: string; transform?: number[]; width?: number };
        if (typeof it.str !== "string" || !it.transform) continue;
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 });
      }
      pages.push(items);
      page.cleanup();
      opts.onProgress?.(p, doc.numPages);
      await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

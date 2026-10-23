"use client";

import type { ImportOutcome } from "@/lib/store";
import { kes } from "@/lib/format";
import { Button, Icon } from "./bits";
import { CoverageStrip } from "./cards";
import { Modal } from "./modal";

function Stat({ value, short, label }: { value: string; short: string; label: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-ground p-2.5 sm:p-3.5">
      <div className="truncate text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
      <div className="text-xs leading-tight text-mute sm:text-[13px]">
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{label}</span>
      </div>
    </div>
  );
}

function Verdict({ o }: { o: ImportOutcome }) {
  const gapTotal = o.gaps.reduce((s, g) => s + g.amount, 0);
  const lines: { ok: boolean; text: string }[] = [];

  if (o.incomplete) {
    lines.push({
      ok: false,
      text: `This file has ${o.pagesRead} of ${o.declaredPages} pages, so the statement is incomplete and totals will be too low. Download the full statement and add it too.`,
    });
  } else if (o.verification === "verified") {
    lines.push({ ok: true, text: "Totals check passed. Every row adds up to the statement’s own totals." });
  } else if (o.verification === "partial") {
    lines.push({
      ok: false,
      text: "We couldn’t fully compare against the statement’s totals. The numbers are probably right, but double-check anything important.",
    });
  } else {
    lines.push({
      ok: false,
      text: "The totals don’t match the statement and the running balance has breaks. Some rows may be missing or misread.",
    });
  }
  if (o.gaps.length > 0) {
    lines.push({
      ok: true,
      text: `Safaricom’s own balance jumps in ${o.gaps.length} place${o.gaps.length === 1 ? "" : "s"} (${kes(Math.abs(gapTotal))} in total). Your totals are still complete.`,
    });
  }

  return (
    <ul className="flex flex-col gap-2 text-sm leading-relaxed">
      {lines.map((l) => (
        <li key={l.text} className="flex gap-2">
          <span className={l.ok ? "mt-0.5 text-pos" : "mt-0.5 text-bad"}>
            <Icon name={l.ok ? "check" : "alert"} size={16} />
          </span>
          <span>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function ImportSummaryDialog({
  outcome,
  onAddAnother,
  onClose,
}: {
  outcome: ImportOutcome | null;
  onAddAnother: () => void;
  onClose: () => void;
}) {
  const o = outcome;
  return (
    <Modal open={!!o} onClose={onClose} labelledBy="summary-title" maxWidth="max-w-[640px]">
      {o ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
              <Icon name="check" size={22} />
            </span>
            <div>
              <h2 id="summary-title" className="text-xl font-bold leading-tight sm:text-[22px]">
                Statement added
              </h2>
              <p className="text-[13px] text-mute">Mobile {o.accountLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat value={o.read.toLocaleString("en-US")} short="Read" label="Transactions read" />
            <Stat value={o.added.toLocaleString("en-US")} short="New" label="New" />
            <Stat value={o.skipped.toLocaleString("en-US")} short="Skipped" label="Already saved, skipped" />
          </div>
          <Verdict o={o} />
          <div>
            <h3 className="mb-2 text-sm font-semibold">Coverage on this device</h3>
            <CoverageStrip coverage={o.coverage} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" onClick={onAddAnother}>
              Add another statement
            </Button>
            <Button className="w-full sm:w-auto" variant="primary" onClick={onClose}>
              View dashboard
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

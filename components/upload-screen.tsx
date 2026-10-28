"use client";

import { useRef, useState } from "react";
import type { ImportPhase } from "@/lib/use-import";
import { Button, Card, Chip, Icon } from "./bits";
import { LogoMark } from "./logo";

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center gap-4 rounded-[20px] border-2 border-dashed p-6 text-center sm:flex-row sm:text-left ${
        over ? "border-brand bg-brand-soft" : "border-[#7fa38d] bg-white/85"
      }`}
    >
      <span className="flex size-[60px] shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
        <Icon name="upload" size={28} />
      </span>
      <div className="flex-1">
        <div className="text-lg font-bold">Drop your statement PDF here</div>
        <p className="mt-1 text-[13px] text-mute">PDF only. Password-protected files are fine.</p>
      </div>
      <Button variant="primary" className="min-h-12 px-6" onClick={() => input.current?.click()}>
        Choose a PDF
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a statement PDF"
        data-testid="file-input"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

type StepState = "done" | "active" | "pending";

function Step({ state, children }: { state: StepState; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-3 ${state === "pending" ? "text-mute" : ""}`}>
      <span
        className={`flex size-[22px] items-center justify-center rounded-full border-2 ${
          state === "done" ? "border-brand bg-brand text-white" : state === "active" ? "border-brand" : "border-[#cbd3cc]"
        }`}
      >
        {state === "done" ? <Icon name="check" size={13} /> : null}
      </span>
      <span className={state === "active" ? "font-semibold" : ""}>{children}</span>
    </li>
  );
}

/** Shown while a statement is being read (on the upload screen, or in a dialog when data already exists). */
export function ProgressPanel({
  file,
  phase,
  progress,
}: {
  file: { name: string; size: number } | null;
  phase: ImportPhase;
  progress: { page: number; total: number };
}) {
  const saving = phase === "saving";
  const opened = progress.total > 0 || saving;
  const pct = saving ? 100 : progress.total ? Math.round((progress.page / progress.total) * 100) : 0;
  return (
    <div className="flex flex-col gap-5 rounded-[20px] border border-line bg-white p-6 text-left shadow-sm" aria-live="polite">
      {file ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-medium">PDF</span>
          <strong className="break-all">{file.name}</strong>
          <span className="text-mute">{size(file.size)}</span>
        </p>
      ) : null}
      <div>
        <div className="mb-2 flex justify-between text-sm">
          <strong>{saving ? "Checking and saving" : "Reading transactions"}</strong>
          <span className="text-mute">
            {saving ? "Almost done" : progress.total ? `Page ${progress.page} of ${progress.total}` : "Opening the file…"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Reading the statement"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2.5 rounded-full bg-line"
        >
          <div className="h-2.5 rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        <Step state={opened ? "done" : "active"}>Opened the file</Step>
        <Step state={saving ? "done" : opened ? "active" : "pending"}>Reading transactions</Step>
        <Step state={saving ? "active" : "pending"}>Checking every balance adds up</Step>
      </ul>
      <p className="text-[13px] text-mute">This runs on your device. You can close the tab to cancel.</p>
    </div>
  );
}

const SAMPLE_IN = [31, 34, 29, 38, 36, 41, 39, 44];
const SAMPLE_OUT = [28, 33, 31, 35, 33, 38, 36, 40];

function Preview() {
  return (
    <div className="relative mx-auto hidden h-[520px] w-full max-w-[540px] @min-[440px]:block" aria-hidden="true">
      <div className="absolute left-3 top-2 w-[calc(100%-1.5rem)] max-w-[500px] rounded-[20px] border border-line bg-white p-5 shadow-[0_24px_60px_rgba(14,124,74,0.18)]">
        <div className="mb-3 flex items-center justify-between">
          <strong>Overview</strong>
          <span className="rounded-lg bg-chip px-3 py-1 text-[13px] font-medium">Example</span>
        </div>
        <div className="mb-2 flex gap-4">
          <div className="flex-1"><div className="text-[13px] text-mute">Money in</div><div className="text-lg font-bold text-pos">KES 428,640</div></div>
          <div className="flex-1"><div className="text-[13px] text-mute">Money out</div><div className="text-lg font-bold text-neg">KES 384,210</div></div>
          <div className="flex-1"><div className="text-[13px] text-mute">Net</div><div className="text-lg font-bold">+KES 38,315</div></div>
        </div>
        <svg viewBox="0 0 640 220" width="100%">
          {[0, 1, 2].map((i) => (
            <line key={i} x1="10" x2="630" y1={60 + i * 50} y2={60 + i * 50} stroke="#E3E7E1" />
          ))}
          {SAMPLE_IN.map((v, i) => (
            <g key={i}>
              <rect x={30 + i * 76} y={190 - v * 3.4} width="24" height={v * 3.4} rx="4" fill="#0E7C4A" />
              <rect x={58 + i * 76} y={190 - SAMPLE_OUT[i] * 3.4} width="24" height={SAMPLE_OUT[i] * 3.4} rx="4" fill="#E39A4B" />
            </g>
          ))}
        </svg>
        <div className="mt-2 flex flex-col gap-3">
          {[["Bills", 24], ["Buy goods", 22]].map(([n, p]) => (
            <div key={String(n)}>
              <div className="flex justify-between text-[13px]"><span>{n}</span><span className="text-mute">{p}%</span></div>
              <div className="mt-1 h-2 rounded bg-chip"><div className="h-2 rounded bg-brand" style={{ width: `${Number(p) * 4}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      {/* <div className="absolute bottom-6 left-0 flex w-[280px] items-start gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-lg">
        <Chip className="!p-2"><Icon name="check" size={18} /></Chip>
        <div><strong className="text-sm">Balance check passed</strong><div className="text-[13px] text-mute">Every row verified</div></div>
      </div>*/}
      {/* <div className="absolute bottom-0 right-0 flex w-[270px] items-start gap-3 rounded-2xl bg-ink p-3.5 text-white shadow-xl">
        <span className="text-[#7be0a6]"><Icon name="check" size={20} /></span>
        <div><strong className="text-sm">Duplicates skipped</strong><div className="text-[13px] text-[#d5ddd6]">The same statement twice changes nothing.</div></div>
      </div> */}
    </div>
  );
}

export function UploadScreen({
  onFile,
  phase,
  file,
  progress,
  remember,
  onRememberChange,
}: {
  onFile: (f: File) => void;
  phase: ImportPhase;
  file: { name: string; size: number } | null;
  progress: { page: number; total: number };
  remember: boolean;
  onRememberChange: (on: boolean) => void;
}) {
  const busy = phase === "reading" || phase === "saving" || phase === "password";
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(900px 520px at 88% 8%, #d9eee1 0%, transparent 60%), radial-gradient(700px 420px at 0% 70%, #ecf3e4 0%, transparent 60%), #f6f7f4",
      }}
    >
      <header className="flex items-center gap-3 border-b border-line bg-white/80 px-5 py-3.5 backdrop-blur sm:px-10">
        <span className="flex items-center gap-2.5 text-lg font-bold">
          <LogoMark />
          Pesa Lens
        </span>
        <span className="flex-1" />
        <Chip>
          <Icon name="lock" size={14} />
          <span className="hidden sm:inline">Private: nothing leaves your device</span>
          <span className="sm:hidden">Private</span>
        </Chip>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 pb-12 pt-8 sm:px-10">
        <div className="md:grid md:grid-cols-[minmax(0,600px)_minmax(0,1fr)] md:items-center">
          <div className="max-w-[600px]">
            <Chip>Free, private, no sign-up</Chip>
            <h1 className="mb-4 mt-4 text-[40px] font-bold leading-[1.05] tracking-tight sm:text-[52px]">
              See where your <span className="text-brand">M-Pesa</span> money really goes
            </h1>
            <p className="mb-7 max-w-[520px] text-lg leading-relaxed text-mute">
              Upload your statement PDF and get a full dashboard in seconds. It is read on your device and never uploaded.
            </p>
            {busy ? <ProgressPanel file={file} phase={phase} progress={progress} /> : <DropZone onFile={onFile} />}
            <div className="mt-5 flex items-start gap-3">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => onRememberChange(e.target.checked)}
                className="mt-0.5 size-5 accent-[#0e7c4a]"
              />
              <label htmlFor="remember" className="text-sm font-semibold">
                Remember my data on this device
                <span className="block font-normal text-mute">
                  Saved in your browser so you can come back. Clear it any time.
                </span>
              </label>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              {[["lock", "Read in your browser"], ["check", "No account needed"], ["trash", "Clear it any time"]].map(([i, t]) => (
                <li key={t} className="flex items-center gap-2 text-brand-deep">
                  <Icon name={i as "lock"} size={16} />
                  <span className="text-ink">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="@container hidden min-w-0 md:block md:pl-12">
            <Preview />
          </div>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["1", "Request your statement", "Ask Safaricom for the full PDF."],
            ["2", "Get the password", "It arrives in a separate message."],
            ["3", "Drop the file here", "Everything is processed on your device."],
          ].map(([n, t, s]) => (
            <li key={n}>
              <Card className="flex h-full items-start gap-3 !p-[18px]">
                <Chip className="min-w-[30px] justify-center font-bold">{n}</Chip>
                <div>
                  <strong>{t}</strong>
                  <p className="mt-0.5 text-[13px] text-mute">{s}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

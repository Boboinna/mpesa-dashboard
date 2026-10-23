"use client";

import { useState } from "react";
import type { PasswordReason } from "@/lib/parser/pdf";
import { Button, FIELD, Icon } from "./bits";
import { Modal } from "./modal";

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Form({
  reason,
  file,
  onSubmit,
  onCancel,
}: {
  reason: PasswordReason;
  file: { name: string; size: number } | null;
  onSubmit: (pw: string) => void;
  onCancel: () => void;
}) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const wrong = reason === "incorrect";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pw) onSubmit(pw);
      }}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
        <Icon name="lock" size={22} />
      </span>
      <h2 id="pw-title" className="text-[22px] font-bold leading-tight">
        This statement is password protected
      </h2>
      <p className="leading-relaxed text-mute">
        Enter the password Safaricom sent you for this file. It is usually sent separately, by SMS or email.
      </p>
      {file ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-medium">PDF</span>
          <strong className="break-all">{file.name}</strong>
          <span className="text-mute">{size(file.size)}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw-input" className="text-sm font-semibold">
          Statement password
        </label>
        <input
          id="pw-input"
          name="statement-password"
          type={show ? "text" : "password"}
          autoComplete="off"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          aria-invalid={wrong}
          aria-describedby={wrong ? "pw-error" : undefined}
          className={`${FIELD} w-full ${wrong ? "border-bad" : ""}`}
        />
        {wrong ? (
          <p id="pw-error" role="alert" className="text-sm text-bad">
            Incorrect password. Check the message from Safaricom and try again.
          </p>
        ) : null}
        <label className="mt-1 flex items-center gap-2 text-[13px] font-normal text-mute">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4" />
          Show password
        </label>
      </div>
      <p className="text-[13px] text-mute">Used only to open the file on this device. It is never saved.</p>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!pw}>
          Unlock statement
        </Button>
      </div>
    </form>
  );
}

export function PasswordDialog({
  open,
  reason,
  file,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  reason: PasswordReason;
  file: { name: string; size: number } | null;
  onSubmit: (pw: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="pw-title">
      <Form reason={reason} file={file} onSubmit={onSubmit} onCancel={onCancel} />
    </Modal>
  );
}

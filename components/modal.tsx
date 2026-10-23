"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal built on the native <dialog> element: focus trapping, Escape and the
 * backdrop come from the browser. Content is only rendered while open, so any
 * form state inside resets every time it opens.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  maxWidth = "max-w-[480px]",
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  maxWidth?: string;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] ${maxWidth} rounded-[20px] border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/55`}
    >
      {open ? <div className="max-h-[90dvh] overflow-y-auto p-5 sm:p-8">{children}</div> : null}
    </dialog>
  );
}

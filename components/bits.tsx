import type { ButtonHTMLAttributes, ReactNode } from "react";

// Small shared building blocks. Icons are inline SVG so there is no icon-library dependency.

export type IconName =
  | "upload" | "lock" | "check" | "trash" | "chevron" | "x"
  | "alert" | "download" | "plus" | "info";

const PATHS: Record<IconName, ReactNode> = {
  upload: <path d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />,
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
  check: <path d="M5 12l5 5L20 7" />,
  trash: <path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (<><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5m0 3h.01" /></>),
  download: <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";
const VARIANTS = {
  primary: "border-brand bg-brand text-white hover:bg-brand-deep",
  secondary: "border-[#CBD3CC] bg-white text-ink hover:bg-chip",
  danger: "border-bad bg-bad text-white hover:bg-[#8f1d13]",
  ghost: "border-transparent bg-transparent text-brand-deep hover:bg-brand-soft",
} as const;

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return <button type={type} className={`${BTN} ${VARIANTS[variant]} ${className}`} {...rest} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={`rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(20,33,26,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-[15px] font-bold">{title}</h2>
        {subtitle ? <p className="text-[13px] text-mute">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[10px] bg-chip p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-[8px] px-3 text-[13px] ${
              on ? "bg-white font-bold text-ink shadow-sm" : "font-medium text-[#4b574f] hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-medium text-brand-deep ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-mute">{children}</p>;
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export const FIELD =
  "min-h-11 rounded-[10px] border border-[#CBD3CC] bg-white px-3 text-sm font-medium text-ink placeholder:text-mute";

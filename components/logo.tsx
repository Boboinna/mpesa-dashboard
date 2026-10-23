/** The Pesa Lens mark: the letter P whose bowl is a lens, with a coin dot. Inline SVG, no extra request. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#0E7C4A" />
      <rect x="17" y="13" width="8" height="38" rx="4" fill="#fff" />
      <circle cx="35" cy="27" r="12" fill="none" stroke="#fff" strokeWidth="7" />
      <circle cx="35" cy="27" r="3.2" fill="#E39A4B" />
    </svg>
  );
}

/** The signature detail: a lit window. Marks anything live or earning, and is the logo mark. */
export function WindowMark({ size = 16, lit = true, className = "" }: { size?: number; lit?: boolean; className?: string }) {
  const fill = lit ? "var(--color-lamp)" : "var(--color-raised)";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className={`shrink-0 ${className}`}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill={fill} />
      <rect x="7.4" y="1.5" width="1.2" height="13" fill="var(--color-bg)" />
      <rect x="1.5" y="7.4" width="13" height="1.2" fill="var(--color-bg)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <WindowMark size={20} />
      <span className="text-[17px] font-medium tracking-normal">Backing</span>
    </span>
  );
}

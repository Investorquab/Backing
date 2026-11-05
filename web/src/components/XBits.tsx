"use client";
import { BadgeCheck } from "lucide-react";
import { useXPost } from "@/lib/xhooks";
import { parseXPost } from "@/lib/x";

/** The X logo, drawn as a simple glyph. */
export function XGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z" />
    </svg>
  );
}

export function Verified({ title = "X account linked" }: { title?: string }) {
  return (
    <span title={title} className="inline-flex shrink-0 text-lamp">
      <BadgeCheck size={16} strokeWidth={1.75} aria-label={title} />
    </span>
  );
}

/** A post from X, shown inside a Backing post. Reads the public post via our server (no X API key). */
export function XPostCard({ url }: { url: string }) {
  const parsed = parseXPost(url);
  const { data, isLoading, isError } = useXPost(parsed ? url : undefined);
  if (!parsed) return null;
  const open = (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
      <XGlyph size={12} /> View on X
    </a>
  );
  if (isLoading) return <div className="mt-3 h-24 animate-pulse rounded-[16px] border border-[var(--line)] bg-raised/40" />;
  if (isError || !data)
    return (
      <div className="mt-3 rounded-[16px] border border-[var(--line)] px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-[14px] text-fg-2">A post by @{parsed.handle} on X</div>
        <div className="mt-1">{open}</div>
      </div>
    );
  return (
    <div className="mt-3 rounded-[16px] border border-[var(--line)] px-4 py-3">
      <div className="flex items-center gap-2 text-[14px]">
        <span className="font-medium">{data.name}</span>
        <span className="truncate text-muted">@{data.handle}</span>
        <span className="ml-auto text-fg-2">
          <XGlyph size={14} />
        </span>
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-[15px]">{data.text}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] text-muted">{data.date}</span>
        {open}
      </div>
    </div>
  );
}

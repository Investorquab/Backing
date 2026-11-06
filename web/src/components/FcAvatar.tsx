/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";

/**
 * Avatar for a Farcaster user (their pfp). Unlike the on-chain Avatar this doesn't use the strict
 * image allowlist, because the URL comes from our trusted Neynar proxy, not arbitrary on-chain input.
 * Still https-only, with an initials fallback if the image is missing or fails to load.
 */
export function FcAvatar({ pfp, name, size = 40 }: { pfp?: string; name?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  const ok = pfp && /^https:\/\//.test(pfp);
  if (ok && !broken) {
    return (
      <img
        src={pfp}
        alt={name ?? ""}
        style={style}
        loading="lazy"
        className="shrink-0 rounded-full border border-[var(--line)] bg-raised object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  const initials = (name ?? "?").replace(/^@/, "").slice(0, 2).toUpperCase();
  return (
    <div
      style={{ ...style, fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-raised font-medium text-fg-2"
      aria-hidden
    >
      {initials}
    </div>
  );
}

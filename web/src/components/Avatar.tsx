/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { safeImage } from "@/lib/images";

function hue(address: string, salt: number) {
  let h = salt;
  for (let i = 2; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function Avatar({ address, src, name, size = 40 }: { address: string; src?: string; name?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  // Only load avatars from trusted hosts (our site + the upload store), same as post images,
  // so a profile can't point the <img> at an arbitrary server to track or fingerprint viewers.
  const ok = safeImage(src);
  if (ok && !broken) {
    return (
      <img
        src={ok}
        alt={name ?? ""}
        style={style}
        className="shrink-0 rounded-full border border-[var(--line)] bg-raised object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  const a = hue(address.toLowerCase(), 7);
  const b = hue(address.toLowerCase(), 13);
  const initials = name
    ?.split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      style={{ ...style, background: `hsl(${a} 22% ${24 + (b % 10)}%)`, fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center rounded-full border border-[var(--line)] font-medium text-white/90"
      aria-hidden
    >
      {initials}
    </div>
  );
}

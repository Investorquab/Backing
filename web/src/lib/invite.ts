"use client";
import { isAddress } from "viem";

const KEY = "backing:ref";

/** Remember who invited this visitor (?ref=0x… on any link), so their first backing credits them. */
export function captureRef() {
  try {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r && isAddress(r)) localStorage.setItem(KEY, r);
  } catch {}
}

export function storedRef(): `0x${string}` | null {
  try {
    const r = localStorage.getItem(KEY);
    return r && isAddress(r) ? (r as `0x${string}`) : null;
  } catch {
    return null;
  }
}

/** A profile link that credits `from` when someone backs through it. */
export function inviteLink(username: string, from?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/u/${username}${from ? `?ref=${from}` : ""}`;
}

export function xIntent(text: string, url?: string) {
  const q = new URLSearchParams({ text });
  if (url) q.set("url", url);
  return `https://x.com/intent/post?${q.toString()}`;
}

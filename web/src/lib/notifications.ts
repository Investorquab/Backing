"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useAccount } from "wagmi";
import { Kind, useInbox } from "./hooks";
import { useNet } from "./net";

const KEY = (net: string, a: string) => `backing:seen:${net}:${a.toLowerCase()}`;

/**
 * Shared "last seen notification id" store. It is synced to localStorage and, crucially,
 * shared across every component that reads it (the top-bar bell and the notifications page),
 * so marking notifications read clears the badge everywhere at once, not just after a reload.
 * Reading it synchronously via useSyncExternalStore also avoids the first-paint flash where the
 * bell briefly showed every notification as unread before localStorage was read.
 */
const cache = new Map<string, bigint>();
const listeners = new Set<() => void>();

function readStored(key: string): bigint {
  try {
    return BigInt(localStorage.getItem(key) ?? "0");
  } catch {
    return 0n;
  }
}
function getSeen(key: string): bigint {
  if (!cache.has(key)) cache.set(key, typeof window === "undefined" ? 0n : readStored(key));
  return cache.get(key)!;
}
function setSeen(key: string, id: bigint) {
  if (cache.get(key) === id) return;
  cache.set(key, id);
  try {
    localStorage.setItem(key, id.toString());
  } catch {}
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith("backing:seen:")) {
      cache.delete(e.key);
      listeners.forEach((l) => l());
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Your notifications: who backed you, who stopped, milestones, and backers your invite link brought. */
export function useNotifications() {
  const { address } = useAccount();
  const { net } = useNet();
  const { data, isLoading } = useInbox(address, 100);
  const key = address ? KEY(net.key, address) : "";
  const seen = useSyncExternalStore(
    subscribe,
    () => (key ? getSeen(key) : 0n),
    () => 0n,
  );

  const items = useMemo(
    () => (data ?? []).filter((a) => a.kind === Kind.Backed || a.kind === Kind.Unbacked || a.kind === Kind.Milestone),
    [data],
  );
  const unread = items.filter((a) => a.id > seen).length;

  const markSeen = () => {
    if (!key || !items.length) return;
    setSeen(key, items[0].id);
  };
  return { items, unread, seen, markSeen, isLoading };
}

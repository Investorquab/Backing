"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Kind, useInbox } from "./hooks";
import { useNet } from "./net";

const KEY = (net: string, a: string) => `backing:seen:${net}:${a.toLowerCase()}`;

/** Your notifications: who backed you, who stopped, milestones, and backers your invite link brought. */
export function useNotifications() {
  const { address } = useAccount();
  const { net } = useNet();
  const { data, isLoading } = useInbox(address, 100);
  const [seen, setSeen] = useState(0n);

  useEffect(() => {
    if (!address) return;
    try {
      setSeen(BigInt(localStorage.getItem(KEY(net.key, address)) ?? "0"));
    } catch {}
  }, [address, net.key]);

  const items = useMemo(
    () => (data ?? []).filter((a) => a.kind === Kind.Backed || a.kind === Kind.Unbacked || a.kind === Kind.Milestone),
    [data],
  );
  const unread = items.filter((a) => a.id > seen).length;

  const markSeen = () => {
    if (!address || !items.length) return;
    setSeen(items[0].id);
    try {
      localStorage.setItem(KEY(net.key, address), items[0].id.toString());
    } catch {}
  };
  return { items, unread, seen, markSeen, isLoading };
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Kind, useCreatorActivity, usePositions } from "./hooks";
import { useNet } from "./net";

const KEY = (net: string, a: string) => `backing:seen:${net}:${a.toLowerCase()}`;
const SHOWN = new Set([Kind.Backed, Kind.Commented, Kind.Milestone, Kind.Ended, Kind.Claimed]);

/** Notifications: what happened to you as a creator, plus your timed backings that have ended. */
export function useNotifications() {
  const { address } = useAccount();
  const { net } = useNet();
  const { data: activity, isLoading } = useCreatorActivity(address, 100);
  const { data: positions } = usePositions(address);
  const [seen, setSeen] = useState(0n);

  useEffect(() => {
    if (!address) return;
    try {
      setSeen(BigInt(localStorage.getItem(KEY(net.key, address)) ?? "0"));
    } catch {}
  }, [address, net.key]);

  const items = useMemo(
    () =>
      (activity ?? []).filter(
        (a) => a.kind === Kind.Milestone || (SHOWN.has(a.kind) && a.actor.toLowerCase() !== address?.toLowerCase()),
      ),
    [activity, address],
  );
  const now = Math.floor(Date.now() / 1000);
  const ended = useMemo(() => (positions ?? []).filter((p) => p.principal > 0n && p.endsAt > 0n && Number(p.endsAt) <= now), [positions, now]);
  const unread = items.filter((a) => a.id > seen).length + ended.length;

  const markSeen = () => {
    if (!address || !items.length) return;
    const top = items[0].id;
    setSeen(top);
    try {
      localStorage.setItem(KEY(net.key, address), top.toString());
    } catch {}
  };

  return { items, ended, unread, seen, markSeen, isLoading };
}

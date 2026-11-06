"use client";
import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backingAbi, demoVaultAbi } from "./abi";
import { useNet } from "./net";
import { FALLBACK_APY, isHidden } from "./networks";
import { useMiniApp } from "./miniapp";
import { errMsg } from "./format";

const POLL = 5_000;
export const ZERO = "0x0000000000000000000000000000000000000000" as const;

function useBackingRead<T extends string>(functionName: T, args?: readonly unknown[], enabled = true) {
  const { net } = useNet();
  const d = net.deployment;
  return useReadContract({
    chainId: net.chain.id,
    address: d?.backing ?? ZERO,
    abi: backingAbi,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    functionName: functionName as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: args as any,
    query: { enabled: !!d && enabled, refetchInterval: POLL },
  });
}

// ---------------------------------------------------------------- types

export type Profile = { username: string; baseName: string; avatar: string; bio: string; link: string };

export type ProfileView = {
  account: `0x${string}`;
  profile: Profile;
  joinedAt: bigint;
  nextClaimAt: bigint;
  principal: bigint;
  backerCount: bigint;
  backingCount: bigint;
  claimable: bigint;
  totalClaimed: bigint;
  totalEarned: bigint;
  postCount: bigint;
  referred: bigint;
};

export enum Kind {
  Joined = 0,
  Backed = 1,
  Unbacked = 2,
  Claimed = 3,
  Posted = 4,
  Milestone = 5,
}

export type Activity = {
  id: bigint;
  kind: Kind;
  actor: `0x${string}`;
  subject: `0x${string}`;
  referrer: `0x${string}`;
  amount: bigint;
  time: number;
  text: string;
  image: string;
};

export type PositionView = { backer: `0x${string}`; creator: `0x${string}`; principal: bigint; yieldGenerated: bigint; since: bigint };

type RawActivity = Omit<Activity, "id" | "kind" | "time"> & { kind: number; time: number };

function toActivities(res: unknown): Activity[] | undefined {
  const d = res as readonly [readonly bigint[], readonly RawActivity[]] | undefined;
  if (!d) return undefined;
  return d[1]
    .map((a, i) => ({ ...a, id: d[0][i], kind: a.kind as Kind, time: Number(a.time) }))
    .filter((a) => !isHidden(a.subject) && !isHidden(a.actor));
}

const byPrincipal = (a: PositionView, b: PositionView) => (b.principal > a.principal ? 1 : b.principal < a.principal ? -1 : 0);

// ---------------------------------------------------------------- people

export function usePeople() {
  const q = useBackingRead("getPeople", [0n, 1000n]);
  const data = useMemo(() => (q.data as ProfileView[] | undefined)?.filter((p) => !isHidden(p.account)), [q.data]);
  return { ...q, data };
}

/** address (lowercase) -> profile, for showing names and pictures anywhere. */
export function usePeopleMap() {
  const { data } = usePeople();
  return useMemo(() => new Map((data ?? []).map((p) => [p.account.toLowerCase(), p])), [data]);
}

export function useProfile(addr?: `0x${string}`) {
  const q = useBackingRead("getProfile", [addr ?? ZERO], !!addr);
  const data = q.data as ProfileView | undefined;
  const ok = !!data && data.joinedAt > 0n && !isHidden(data.account);
  return { ...q, data: ok ? data : undefined, missing: !!data && !ok };
}

export function useProfileByUsername(username?: string) {
  const q = useBackingRead("getProfileByUsername", [username ?? ""], !!username);
  const data = q.data as ProfileView | undefined;
  const ok = !!data && data.joinedAt > 0n && !isHidden(data.account);
  return { ...q, data: ok ? data : undefined, missing: !!data && !ok };
}

/** Everyone backing `addr`, biggest first. */
export function useBackers(addr?: `0x${string}`) {
  const q = useBackingRead("getBackers", [addr ?? ZERO], !!addr);
  const rows = useMemo(() => (q.data ? [...(q.data as unknown as PositionView[])].sort(byPrincipal) : undefined), [q.data]);
  return { ...q, rows };
}

/** Everyone `addr` is backing, biggest first. */
export function useBacking(addr?: `0x${string}`) {
  const q = useBackingRead("getBacking", [addr ?? ZERO], !!addr);
  const rows = useMemo(() => (q.data ? [...(q.data as unknown as PositionView[])].sort(byPrincipal) : undefined), [q.data]);
  return { ...q, rows };
}

/**
 * Given candidate wallets (e.g. a Farcaster account's verified addresses), find the first that has a
 * Backing profile. data: ProfileView when one is on Backing, null when none are, undefined while loading.
 */
export function useProfileAmong(addresses: readonly string[] | undefined) {
  const { net } = useNet();
  const d = net.deployment;
  const addrs = useMemo(() => (addresses ?? []).filter((a) => isAddress(a)) as `0x${string}`[], [addresses]);
  const q = useReadContracts({
    contracts: addrs.map((a) => ({
      chainId: net.chain.id,
      address: d?.backing ?? ZERO,
      abi: backingAbi,
      functionName: "getProfile",
      args: [a],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any,
    query: { enabled: !!d && addrs.length > 0, refetchInterval: POLL },
  });
  const data = useMemo(() => {
    if (addrs.length === 0) return null;
    if (!q.data) return undefined;
    for (const r of q.data) {
      if (r.status === "success") {
        const p = r.result as unknown as ProfileView;
        if (p && p.joinedAt > 0n && !isHidden(p.account)) return p;
      }
    }
    return null;
  }, [q.data, addrs.length]);
  return { ...q, data };
}

/**
 * Map of wallet (lowercase) -> Backing profile, for a flat list of candidate wallets.
 * Used by the "On Farcaster" feed to tell which real builders are already on Backing (show Back)
 * versus not yet (show Invite). Only joined, non-hidden profiles are included.
 */
export function useMembershipMap(addresses: readonly string[] | undefined) {
  const { net } = useNet();
  const d = net.deployment;
  const addrs = useMemo(() => {
    const uniq = new Set((addresses ?? []).map((a) => a.toLowerCase()).filter((a) => isAddress(a)));
    return [...uniq] as `0x${string}`[];
  }, [addresses]);
  const q = useReadContracts({
    contracts: addrs.map((a) => ({
      chainId: net.chain.id,
      address: d?.backing ?? ZERO,
      abi: backingAbi,
      functionName: "getProfile",
      args: [a],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any,
    query: { enabled: !!d && addrs.length > 0, refetchInterval: POLL },
  });
  const map = useMemo(() => {
    const m = new Map<string, ProfileView>();
    if (!q.data) return m;
    q.data.forEach((r, i) => {
      if (r.status === "success") {
        const p = r.result as unknown as ProfileView;
        if (p && p.joinedAt > 0n && !isHidden(p.account)) m.set(addrs[i].toLowerCase(), p);
      }
    });
    return m;
  }, [q.data, addrs]);
  return { ...q, map };
}

export function usePosition(backer?: `0x${string}`, creator?: `0x${string}`) {
  const q = useBackingRead("getPosition", [backer ?? ZERO, creator ?? ZERO], !!backer && !!creator);
  return { ...q, data: q.data as PositionView | undefined };
}

// ---------------------------------------------------------------- posts and inbox

export function usePosts(limit: number) {
  const q = useBackingRead("getPosts", [0n, BigInt(limit)]);
  return { ...q, data: useMemo(() => toActivities(q.data), [q.data]) };
}

export function usePostsBy(addr: `0x${string}` | undefined, limit: number) {
  const q = useBackingRead("getPostsBy", [addr ?? ZERO, 0n, BigInt(limit)], !!addr);
  return { ...q, data: useMemo(() => toActivities(q.data), [q.data]) };
}

/**
 * Newest-first posts from a set of creators, merged across them. Used by the feed's
 * "People I back" tab so it shows every post from people you back, not just the ones
 * that happen to be in the newest page of the global feed.
 */
export function usePostsByCreators(creators: readonly `0x${string}`[], enabled: boolean) {
  const { net } = useNet();
  const d = net.deployment;
  const contracts = useMemo(
    () =>
      creators.map((c) => ({
        chainId: net.chain.id,
        address: d?.backing ?? ZERO,
        abi: backingAbi,
        functionName: "getPostsBy",
        args: [c, 0n, 50n],
      })),
    [creators, d?.backing, net.chain.id],
  );
  const q = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: !!d && enabled && creators.length > 0, refetchInterval: POLL },
  });
  const data = useMemo(() => {
    if (!enabled) return undefined;
    if (creators.length === 0) return [] as Activity[];
    if (!q.data) return undefined;
    const all: Activity[] = [];
    for (const r of q.data) {
      if (r.status === "success") {
        const acts = toActivities(r.result);
        if (acts) all.push(...acts);
      }
    }
    all.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
    return all;
  }, [q.data, enabled, creators.length]);
  return { ...q, data };
}

/** Everything that concerns `addr`, newest first: their notifications. */
export function useInbox(addr: `0x${string}` | undefined, limit: number) {
  const q = useBackingRead("getInbox", [addr ?? ZERO, 0n, BigInt(limit)], !!addr);
  return { ...q, data: useMemo(() => toActivities(q.data), [q.data]) };
}

export function useStats() {
  const q = useBackingRead("stats");
  const d = q.data as readonly [bigint, bigint, bigint, bigint] | undefined;
  return { ...q, stats: d && { principal: d[0], people: d[1], distributed: d[2], claimed: d[3] } };
}

/**
 * apr: the vault's actual rate (drives live tickers). On demo networks this is deliberately sped up.
 * incomeApr: the rate used for "a month" figures, a realistic APY on demo networks.
 */
export function useApr(): { apr: number; estimated: boolean; incomeApr: number; demo: boolean } {
  const { net } = useNet();
  const d = net.deployment;
  const client = usePublicClient({ chainId: net.chain.id });
  const demo = useReadContract({
    chainId: net.chain.id,
    address: d?.vault ?? ZERO,
    abi: demoVaultAbi,
    functionName: "aprBps",
    query: { enabled: !!d?.demo },
  });
  const live = useQuery({
    queryKey: ["apr", net.key, d?.vault],
    enabled: !!d && !d.demo && !!client,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const now = await client!.getBlockNumber();
      const lookback = 129_600n; // ~3 days of 2s blocks
      const one = 10n ** 18n;
      const read = (blockNumber?: bigint) =>
        client!.readContract({ address: d!.vault, abi: demoVaultAbi, functionName: "convertToAssets", args: [one], blockNumber });
      const [a, b] = await Promise.all([read(now - lookback), read(now)]);
      const apr = (Number(b) / Number(a) - 1) * (365 / 3);
      if (!isFinite(apr) || apr <= 0 || apr > 1) throw new Error("bad apr");
      return apr;
    },
  });
  if (d?.demo) return { apr: demo.data ? Number(demo.data) / 10_000 : 0, estimated: false, incomeApr: FALLBACK_APY, demo: true };
  const apr = live.data ?? FALLBACK_APY;
  return { apr, estimated: !live.data, incomeApr: apr, demo: false };
}

/** Smoothly interpolates a value that grows at `perSecond` since `at` (ms). */
export function useLive(value: number, perSecond: number, at: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!perSecond) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [perSecond]);
  if (!at) return value;
  return value + (perSecond * Math.max(0, now - at)) / 1000;
}

// ---------------------------------------------------------------- transactions

export type TxStep = { label: string; run: () => Promise<`0x${string}`> };
export type TxState = { status: "idle" | "pending" | "success" | "error"; message?: string; hash?: `0x${string}` };

/** Runs one or more wallet transactions in order, switching chain first, and refreshes reads. */
export function useTx() {
  const { net } = useNet();
  const { chainId, isConnected, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync: rawWrite } = useWriteContract();
  const client = usePublicClient({ chainId: net.chain.id });
  const qc = useQueryClient();
  const mini = useMiniApp();
  const [state, setState] = useState<TxState>({ status: "idle" });

  async function send(steps: TxStep[], doneMessage = "Done") {
    if (!isConnected) {
      setState({ status: "error", message: "Sign in first" });
      return false;
    }
    try {
      if (chainId !== net.chain.id) {
        setState({ status: "pending", message: `Switching to ${net.chain.name}` });
        await switchChainAsync({ chainId: net.chain.id });
      }
      let hash: `0x${string}` | undefined;
      for (let i = 0; i < steps.length; i++) {
        const prefix = steps.length > 1 ? `Step ${i + 1} of ${steps.length}: ` : "";
        setState({ status: "pending", message: `${prefix}${steps[i].label}. Confirm in your wallet` });
        hash = await steps[i].run();
        setState({ status: "pending", message: `${prefix}${steps[i].label}. Waiting for the network`, hash });
        const r = await client!.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error("Transaction reverted");
      }
      setState({ status: "success", message: doneMessage, hash });
      mini.haptic("success");
      await qc.invalidateQueries();
      return true;
    } catch (e) {
      setState({ status: "error", message: errMsg(e) });
      mini.haptic("error");
      return false;
    }
  }

  /** writeContract with a 30% gas buffer: vault interest accrual can make the mined tx cost more than the estimate. */
  const writeContractAsync = (async (params: Parameters<typeof rawWrite>[0]) => {
    let gas: bigint | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const est = await client!.estimateContractGas({ ...(params as any), account: address });
      gas = (est * 13n) / 10n;
    } catch {
      // let the wallet estimate (and surface the revert reason) if our estimate fails
    }
    return rawWrite({ ...params, ...(gas ? { gas } : {}) } as Parameters<typeof rawWrite>[0]);
  }) as typeof rawWrite;

  return { state, send, reset: () => setState({ status: "idle" }), writeContractAsync, chainId: net.chain.id };
}

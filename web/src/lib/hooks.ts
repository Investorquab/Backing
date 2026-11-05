"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
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

export type CreatorView = {
  creator: `0x${string}`;
  name: string;
  bio: string;
  avatar: string;
  banner: string;
  handle: string;
  fid: bigint;
  x: string;
  xPost: string;
  registeredAt: bigint;
  lastClaimAt: bigint;
  nextClaimAt: bigint;
  principal: bigint;
  backerCount: bigint;
  claimable: bigint;
  totalClaimed: bigint;
  totalEarned: bigint;
  postCount: bigint;
  castCount: bigint;
};

export enum Kind {
  Joined = 0,
  Backed = 1,
  Claimed = 2,
  Posted = 3,
  Milestone = 4,
  Commented = 5,
  Ended = 6,
}

export type Activity = {
  id: bigint;
  kind: Kind;
  actor: `0x${string}`;
  creator: `0x${string}`;
  amount: bigint;
  time: number;
  cast: `0x${string}`;
  ref: bigint;
  text: string;
  link: string;
  image: string;
};

export type PostStats = { backed: bigint; backings: number; comments: number };
export type Post = Activity & { stats: PostStats };
export type CastStat = { cast: `0x${string}`; backed: bigint; backings: bigint };
export type BackerRow = { backer: `0x${string}`; principal: bigint; generated: bigint; endsAt: bigint; lockedUntil: bigint };

export type PositionView = {
  creator: `0x${string}`;
  creatorName: string;
  creatorAvatar: string;
  principal: bigint;
  yieldGenerated: bigint;
  since: bigint;
  endsAt: bigint;
  lockedUntil: bigint;
};

type RawActivity = Omit<Activity, "id" | "kind" | "time"> & { kind: number; time: number };
type RawStats = { backed: bigint; backings: number; comments: number };

function toActivities(ids: readonly bigint[], items: readonly RawActivity[]): Activity[] {
  return items
    .map((a, i) => ({ ...a, id: ids[i], kind: a.kind as Kind, time: Number(a.time) }))
    .filter((a) => !isHidden(a.creator) && !isHidden(a.actor));
}

function toPosts(res: unknown): Post[] | undefined {
  const d = res as readonly [readonly bigint[], readonly RawActivity[], readonly RawStats[]] | undefined;
  if (!d) return undefined;
  const stats = new Map(d[0].map((id, i) => [id, d[2][i]]));
  return toActivities(d[0], d[1]).map((a) => {
    const s = stats.get(a.id)!;
    return { ...a, stats: { backed: s.backed, backings: Number(s.backings), comments: Number(s.comments) } };
  });
}

// ---------------------------------------------------------------- creators

export function useCreators() {
  const q = useBackingRead("getCreators", [0n, 500n]);
  const data = useMemo(() => (q.data as CreatorView[] | undefined)?.filter((c) => !isHidden(c.creator)), [q.data]);
  return { ...q, data };
}

/** address (lowercase) -> creator, for naming people in posts and comments. */
export function useCreatorMap() {
  const { data } = useCreators();
  return useMemo(() => new Map((data ?? []).map((c) => [c.creator.toLowerCase(), c])), [data]);
}

export function useCreator(addr?: `0x${string}`) {
  const q = useBackingRead("getCreator", [addr ?? ZERO], !!addr);
  const data = q.data as CreatorView | undefined;
  const ok = !!data && data.registeredAt > 0n && !isHidden(data.creator);
  return { ...q, data: ok ? data : undefined, missing: !!data && !ok };
}

export function useBackers(addr?: `0x${string}`) {
  const q = useBackingRead("getBackers", [addr ?? ZERO], !!addr);
  const rows = useMemo(
    () =>
      [...((q.data as BackerRow[] | undefined) ?? [])].sort((a, b) => (b.principal > a.principal ? 1 : b.principal < a.principal ? -1 : 0)),
    [q.data],
  );
  return { ...q, rows: q.data ? rows : undefined };
}

export function useCasts(addr?: `0x${string}`) {
  const q = useBackingRead("getCasts", [addr ?? ZERO], !!addr);
  const data = useMemo(
    () => [...((q.data as CastStat[] | undefined) ?? [])].sort((a, b) => (b.backed > a.backed ? 1 : b.backed < a.backed ? -1 : 0)),
    [q.data],
  );
  return { ...q, data };
}

// ---------------------------------------------------------------- posts and comments

export function usePosts(limit: number) {
  const q = useBackingRead("getPosts", [0n, BigInt(limit)]);
  const data = useMemo(() => toPosts(q.data), [q.data]);
  return { ...q, data };
}

export function useCreatorPosts(addr: `0x${string}` | undefined, limit: number) {
  const q = useBackingRead("getCreatorPosts", [addr ?? ZERO, 0n, BigInt(limit)], !!addr);
  const data = useMemo(() => toPosts(q.data), [q.data]);
  return { ...q, data };
}

export function usePost(id?: bigint) {
  const q = useBackingRead("getPost", [id ?? 0n], id !== undefined && id > 0n);
  const data = useMemo(() => {
    const d = q.data as readonly [RawActivity, RawStats] | undefined;
    if (!d || id === undefined) return undefined;
    const [a] = toActivities([id], [d[0]]);
    if (!a) return undefined;
    return { ...a, stats: { backed: d[1].backed, backings: Number(d[1].backings), comments: Number(d[1].comments) } } as Post;
  }, [q.data, id]);
  return { ...q, data };
}

export function useComments(postId?: bigint) {
  const q = useBackingRead("getComments", [postId ?? 0n, 0n, 200n], postId !== undefined && postId > 0n);
  const data = useMemo(() => {
    const d = q.data as readonly [readonly bigint[], readonly RawActivity[]] | undefined;
    return d ? toActivities(d[0], d[1]) : undefined;
  }, [q.data]);
  return { ...q, data };
}

/** Everything that happened to a creator, newest first: their notifications. */
export function useCreatorActivity(addr: `0x${string}` | undefined, limit: number) {
  const q = useBackingRead("getCreatorActivity", [addr ?? ZERO, 0n, BigInt(limit)], !!addr);
  const data = useMemo(() => {
    const d = q.data as readonly [readonly bigint[], readonly RawActivity[]] | undefined;
    return d ? toActivities(d[0], d[1]) : undefined;
  }, [q.data]);
  return { ...q, data };
}

// ---------------------------------------------------------------- positions

export function usePosition(backer?: `0x${string}`, creator?: `0x${string}`) {
  const q = useBackingRead("getPosition", [backer ?? ZERO, creator ?? ZERO], !!backer && !!creator);
  return { ...q, data: q.data as PositionView | undefined };
}

export function usePositions(backer?: `0x${string}`) {
  const q = useBackingRead("getPositions", [backer ?? ZERO], !!backer);
  return { ...q, data: q.data as PositionView[] | undefined };
}

export function useStats() {
  const q = useBackingRead("stats");
  const d = q.data as readonly [bigint, bigint, bigint, bigint] | undefined;
  return { ...q, stats: d && { principal: d[0], creators: d[1], distributed: d[2], claimed: d[3] } };
}

/**
 * apr: the vault's actual rate (drives live tickers). On demo networks this is deliberately sped up.
 * incomeApr: the rate used for "a month" figures — a realistic APY on demo networks.
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

"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backingAbi, demoVaultAbi } from "./abi";
import { useNet } from "./net";
import { FALLBACK_APY } from "./networks";
import { errMsg } from "./format";
import { isHidden } from "./networks";
import { useMiniApp } from "./miniapp";

const POLL = 5_000;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

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

export type CreatorView = {
  creator: `0x${string}`;
  name: string;
  bio: string;
  avatar: string;
  handle: string;
  fid: bigint;
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
}

export type Activity = {
  id: bigint;
  kind: Kind;
  actor: `0x${string}`;
  creator: `0x${string}`;
  amount: bigint;
  time: number;
  cast: `0x${string}`;
  text: string;
  link: string;
};

export type CastStat = { cast: `0x${string}`; backed: bigint; backings: bigint };

export type PositionView = {
  creator: `0x${string}`;
  creatorName: string;
  creatorAvatar: string;
  principal: bigint;
  yieldGenerated: bigint;
  since: bigint;
};

export function useCreators() {
  const q = useBackingRead("getCreators", [0n, 500n]);
  const data = useMemo(() => (q.data as CreatorView[] | undefined)?.filter((c) => !isHidden(c.creator)), [q.data]);
  return { ...q, data };
}

/** address (lowercase) -> creator, for naming actors in the feed. */
export function useCreatorMap() {
  const { data } = useCreators();
  return useMemo(() => new Map((data ?? []).map((c) => [c.creator.toLowerCase(), c])), [data]);
}

type RawActivity = Omit<Activity, "id" | "kind" | "time"> & { kind: number; time: number };

function toActivity(res: unknown): Activity[] | undefined {
  const d = res as readonly [readonly bigint[], readonly RawActivity[]] | undefined;
  if (!d) return undefined;
  return d[1]
    .map((a, i) => ({ ...a, id: d[0][i], kind: a.kind as Kind, time: Number(a.time) }))
    .filter((a) => !isHidden(a.creator) && !isHidden(a.actor));
}

export function useActivity(limit: number) {
  const q = useBackingRead("getActivity", [0n, BigInt(limit)]);
  const data = useMemo(() => toActivity(q.data), [q.data]);
  return { ...q, data };
}

export function useCreatorActivity(addr: `0x${string}` | undefined, limit: number) {
  const q = useBackingRead("getCreatorActivity", [addr ?? ZERO, 0n, BigInt(limit)], !!addr);
  const data = useMemo(() => toActivity(q.data), [q.data]);
  return { ...q, data };
}

export function useCasts(addr?: `0x${string}`) {
  const q = useBackingRead("getCasts", [addr ?? ZERO], !!addr);
  const data = useMemo(
    () => [...((q.data as CastStat[] | undefined) ?? [])].sort((a, b) => (b.backed > a.backed ? 1 : b.backed < a.backed ? -1 : 0)),
    [q.data],
  );
  return { ...q, data };
}

export function useCreator(addr?: `0x${string}`) {
  const q = useBackingRead("getCreator", [addr ?? ZERO], !!addr);
  const data = q.data as CreatorView | undefined;
  const ok = !!data && data.registeredAt > 0n && !isHidden(data.creator);
  return { ...q, data: ok ? data : undefined, missing: !!data && !ok };
}

export function useBackers(addr?: `0x${string}`) {
  const q = useBackingRead("getBackers", [addr ?? ZERO], !!addr);
  const rows = useMemo(() => {
    const d = q.data as readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[]] | undefined;
    if (!d) return undefined;
    return d[0]
      .map((backer, i) => ({ backer, principal: d[1][i], generated: d[2][i] }))
      .sort((a, b) => (b.principal > a.principal ? 1 : b.principal < a.principal ? -1 : 0));
  }, [q.data]);
  return { ...q, rows };
}

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
 * incomeApr: the rate used for "est. per month" figures — a realistic vault APY on demo networks,
 * so we never show inflated income projections.
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
      // Compare the vault's share price now vs ~3 days ago (Base: 2s blocks).
      const now = await client!.getBlockNumber();
      const lookback = 129_600n;
      const one = 10n ** 18n;
      const read = (blockNumber?: bigint) =>
        client!.readContract({ address: d!.vault, abi: demoVaultAbi, functionName: "convertToAssets", args: [one], blockNumber });
      const [a, b] = await Promise.all([read(now - lookback), read(now)]);
      const growth = Number(b) / Number(a) - 1;
      const apr = growth * (365 / 3);
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
        const prefix = steps.length > 1 ? `Step ${i + 1}/${steps.length}: ` : "";
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

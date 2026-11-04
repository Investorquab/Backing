"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";

/** What Base App (or any Farcaster client) tells us when Backing opens as a mini app. */
export type MiniUser = { fid: number; username?: string; displayName?: string; pfpUrl?: string };
export type CastOrigin = { hash: `0x${string}`; author: MiniUser; text: string };

type Ctx = {
  inMiniApp: boolean;
  checked: boolean;
  user?: MiniUser;
  /** The cast Backing was opened from, if any. */
  cast?: CastOrigin;
  clearCast: () => void;
  /** CAIP-2 chains the host wallet supports, e.g. "eip155:8453". Empty when unknown. */
  chains: string[];
  composeCast: (text: string, url?: string) => Promise<boolean>;
  viewCast: (hash: string, authorUsername?: string) => void;
  viewProfile: (fid: number) => void;
  haptic: (kind: "success" | "error") => void;
  addApp: () => Promise<boolean>;
};

const noop = async () => false;
const MiniCtx = createContext<Ctx>({
  inMiniApp: false,
  checked: false,
  chains: [],
  clearCast: () => {},
  composeCast: noop,
  viewCast: () => {},
  viewProfile: () => {},
  haptic: () => {},
  addApp: noop,
});

type Sdk = typeof import("@farcaster/miniapp-sdk").sdk;

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [sdk, setSdk] = useState<Sdk | null>(null);
  const [inMiniApp, setIn] = useState(false);
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<MiniUser>();
  const [cast, setCast] = useState<CastOrigin>();
  const [chains, setChains] = useState<string[]>([]);
  const { connectors, connect } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const inside = await sdk.isInMiniApp();
        if (cancelled) return;
        setIn(inside);
        if (inside) {
          setSdk(sdk);
          const ctx = await sdk.context;
          setUser(ctx.user);
          const loc = ctx.location;
          if (loc && (loc.type === "cast_embed" || loc.type === "cast_share") && /^0x[0-9a-fA-F]{40}$/.test(loc.cast.hash)) {
            setCast({ hash: loc.cast.hash.toLowerCase() as `0x${string}`, author: loc.cast.author, text: loc.cast.text });
          }
          sdk.getChains().then(setChains).catch(() => {});
          await sdk.actions.ready();
        }
      } catch {
        // not in a mini app, or the host didn't answer
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Inside Base App the wallet is already there: connect without asking.
  useEffect(() => {
    if (!inMiniApp || isConnected) return;
    const c = connectors.find((x) => x.id === "farcaster");
    if (c) connect({ connector: c });
  }, [inMiniApp, isConnected, connectors, connect]);

  const composeCast = useCallback(
    async (text: string, url?: string) => {
      if (!sdk) return false;
      try {
        const r = await sdk.actions.composeCast({ text, embeds: url ? [url] : [] });
        return !!r?.cast;
      } catch {
        return false;
      }
    },
    [sdk],
  );

  const value: Ctx = {
    inMiniApp,
    checked,
    user,
    cast,
    clearCast: () => setCast(undefined),
    chains,
    composeCast,
    viewCast: (hash, authorUsername) => sdk?.actions.viewCast({ hash, authorUsername }).catch(() => {}),
    viewProfile: (fid) => sdk?.actions.viewProfile({ fid }).catch(() => {}),
    haptic: (kind) => sdk?.haptics.notificationOccurred(kind).catch(() => {}),
    addApp: async () => {
      if (!sdk) return false;
      try {
        await sdk.actions.addMiniApp();
        return true;
      } catch {
        return false;
      }
    },
  };

  return <MiniCtx.Provider value={value}>{children}</MiniCtx.Provider>;
}

export const useMiniApp = () => useContext(MiniCtx);

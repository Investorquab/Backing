"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AVAILABLE, DEFAULT_NET, NETWORKS, type NetKey, type Network } from "./networks";

type Ctx = { net: Network; setNet: (k: NetKey) => void };
const NetCtx = createContext<Ctx>({ net: NETWORKS[DEFAULT_NET], setNet: () => {} });

const valid = (k: string | null): k is NetKey => !!k && AVAILABLE.some((n) => n.key === k);

export function NetProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState<NetKey>(DEFAULT_NET);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("net");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("backing:net");
    } catch {}
    if (valid(fromUrl)) setKey(fromUrl);
    else if (valid(stored)) setKey(stored);
  }, []);

  const setNet = useCallback((k: NetKey) => {
    setKey(k);
    try {
      localStorage.setItem("backing:net", k);
    } catch {}
    const url = new URL(window.location.href);
    if (url.searchParams.has("net")) {
      url.searchParams.set("net", k);
      window.history.replaceState(null, "", url);
    }
  }, []);

  return <NetCtx.Provider value={{ net: NETWORKS[key], setNet }}>{children}</NetCtx.Provider>;
}

export const useNet = () => useContext(NetCtx);

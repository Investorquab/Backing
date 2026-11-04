import { base, baseSepolia, foundry } from "viem/chains";
import local from "@/deployments/31337.json";
import sepolia from "@/deployments/84532.json";
import mainnet from "@/deployments/8453.json";

export type Deployment = {
  backing: `0x${string}`;
  usdc: `0x${string}`;
  vault: `0x${string}`;
  demo: boolean;
  epochSeconds: number;
};

export type NetKey = "sepolia" | "base" | "local";

export type Network = {
  key: NetKey;
  chain: typeof base | typeof baseSepolia | typeof foundry;
  label: string;
  short: string;
  explorer?: string;
  deployment?: Deployment;
  /** Shown next to amounts, e.g. "tUSDC" on testnets. */
  symbol: string;
  vaultName: string;
};

const dep = (d: unknown) => ((d as Partial<Deployment>)?.backing ? (d as Deployment) : undefined);

export const NETWORKS: Record<NetKey, Network> = {
  sepolia: {
    key: "sepolia",
    chain: baseSepolia,
    label: "Testnet demo",
    short: "Testnet",
    explorer: "https://sepolia.basescan.org",
    deployment: dep(sepolia),
    symbol: "tUSDC",
    vaultName: "Demo vault, sped up",
  },
  base: {
    key: "base",
    chain: base,
    label: "Base mainnet",
    short: "Mainnet",
    explorer: "https://basescan.org",
    deployment: dep(mainnet),
    symbol: "USDC",
    vaultName: process.env.NEXT_PUBLIC_VAULT_NAME || "Morpho USDC vault",
  },
  local: {
    key: "local",
    chain: foundry,
    label: "Local Anvil",
    short: "Local",
    deployment: dep(local),
    symbol: "tUSDC",
    vaultName: "Demo vault, sped up",
  },
};

const showLocal = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SHOW_LOCAL === "true";

export const AVAILABLE: Network[] = (["sepolia", "base", "local"] as NetKey[])
  .map((k) => NETWORKS[k])
  .filter((n) => n.deployment && (n.key !== "local" || showLocal));

export const DEFAULT_NET: NetKey = AVAILABLE[0]?.key ?? "sepolia";

export const FALLBACK_APY = Number(process.env.NEXT_PUBLIC_FALLBACK_APY || "0.05");

/** Addresses whose profiles and posts the site hides (comma separated). On-chain data can't be deleted. */
export const HIDDEN = new Set(
  (process.env.NEXT_PUBLIC_HIDDEN_ADDRESSES || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean),
);
export const isHidden = (a?: string) => !!a && HIDDEN.has(a.toLowerCase());

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export function netFromParam(v?: string | null): NetKey {
  return AVAILABLE.some((n) => n.key === v) ? (v as NetKey) : DEFAULT_NET;
}

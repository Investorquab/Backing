import { createConfig, http } from "wagmi";
import { fallback } from "viem";
import { base, baseSepolia, foundry } from "viem/chains";
import { baseAccount, injected, walletConnect } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Reads fall back across several public RPCs so a flaky endpoint doesn't leave the feed empty.
// A dedicated RPC set via env takes priority (and ranks fastest).
const sepoliaRpcs = [process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC, "https://base-sepolia.drpc.org", "https://base-sepolia.gateway.tenderly.co", "https://sepolia.base.org"].filter(Boolean) as string[];
const baseRpcs = [process.env.NEXT_PUBLIC_BASE_RPC, "https://base.drpc.org", "https://base.gateway.tenderly.co", "https://mainnet.base.org"].filter(Boolean) as string[];

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base, foundry],
  connectors: [
    // Inside Base App / Farcaster clients this connects to the in-app wallet automatically.
    farcasterMiniApp(),
    baseAccount({ appName: "Backing", appLogoUrl: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/icon-1024.png` : undefined }),
    injected({ shimDisconnect: true }),
    ...(wcId ? [walletConnect({ projectId: wcId, showQrModal: true })] : []),
  ],
  transports: {
    [baseSepolia.id]: fallback(sepoliaRpcs.map((u) => http(u))),
    [base.id]: fallback(baseRpcs.map((u) => http(u))),
    [foundry.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

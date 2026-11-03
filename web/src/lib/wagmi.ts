import { createConfig, http } from "wagmi";
import { base, baseSepolia, foundry } from "viem/chains";
import { baseAccount, injected, walletConnect } from "wagmi/connectors";

const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base, foundry],
  connectors: [
    injected({ shimDisconnect: true }),
    baseAccount({ appName: "Backing" }),
    ...(wcId ? [walletConnect({ projectId: wcId, showQrModal: true })] : []),
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || undefined),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC || undefined),
    [foundry.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

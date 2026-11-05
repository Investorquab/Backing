import "server-only";
import { createPublicClient, http } from "viem";
import { NETWORKS, type NetKey } from "./networks";

const RPC: Record<NetKey, string | undefined> = {
  sepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC,
  base: process.env.NEXT_PUBLIC_BASE_RPC,
  local: "http://127.0.0.1:8545",
};

export function clientFor(key: NetKey) {
  const net = NETWORKS[key];
  return createPublicClient({ chain: net.chain, transport: http(RPC[key]) });
}

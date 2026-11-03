"use client";
import { useAccount, useReadContract } from "wagmi";
import { mockUsdcAbi } from "@/lib/abi";
import { useApr, useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { num, usd } from "@/lib/format";
import { TxStatus } from "./ui";

export function NetBanner() {
  const { net } = useNet();
  const { apr } = useApr();
  const { address } = useAccount();
  const d = net.deployment;
  const tx = useTx();
  const bal = useReadContract({
    chainId: net.chain.id,
    address: d?.usdc,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!d && !!address, refetchInterval: 8000 },
  });

  if (!d) {
    return (
      <div className="mx-auto mt-4 max-w-5xl px-4">
        <div className="card border-bad/40 p-4 text-sm text-muted">
          Backing isn&apos;t deployed on {net.chain.name} yet. See the README to deploy the contracts.
        </div>
      </div>
    );
  }
  if (!d.demo) return null;

  return (
    <div className="mx-auto mt-4 max-w-5xl px-4">
      <div className="card flex flex-col gap-3 border-moon/30 p-4 text-sm sm:flex-row sm:items-center">
        <div className="flex-1 text-muted">
          <span className="font-semibold text-moon">{net.label}.</span> Test USDC and a demo vault with sped-up yield (
          {Math.round(apr * 100).toLocaleString()}% APR) so you can watch creator income move in real time.
          {net.key === "sepolia" && (
            <>
              {" "}
              Need gas?{" "}
              <a className="underline decoration-dotted" href="https://portal.cdp.coinbase.com/products/faucet" target="_blank" rel="noreferrer">
                Get Base Sepolia ETH
              </a>
              .
            </>
          )}
        </div>
        {address && (
          <div className="flex items-center gap-3">
            <span className="num text-xs text-dim">
              {usd(num(bal.data as bigint | undefined))} {net.symbol}
            </span>
            <button
              className="btn btn-ghost px-4 py-2 text-sm"
              disabled={tx.state.status === "pending"}
              onClick={() =>
                tx.send(
                  [{ label: "Mint 1,000 test USDC", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.usdc, abi: mockUsdcAbi, functionName: "faucet" }) }],
                  "1,000 tUSDC added to your wallet",
                )
              }
            >
              Get 1,000 test USDC
            </button>
          </div>
        )}
      </div>
      <TxStatus state={tx.state} />
    </div>
  );
}

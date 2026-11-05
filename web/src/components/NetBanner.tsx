"use client";
import { useAccount, useReadContract } from "wagmi";
import { mockUsdcAbi } from "@/lib/abi";
import { useApr, useTx } from "@/lib/hooks";
import { useNet } from "@/lib/net";
import { useMiniApp } from "@/lib/miniapp";
import { money, num } from "@/lib/format";
import { TxStatus } from "./ui";

export function NetBanner() {
  const { net } = useNet();
  const { apr } = useApr();
  const { address } = useAccount();
  const mini = useMiniApp();
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

  const wrap = (children: React.ReactNode) => <div className="border-b border-[var(--line)] px-4 py-3">{children}</div>;

  if (!d) return wrap(<div className="text-[14px] text-fg-2">Backing isn&apos;t deployed on {net.chain.name} yet. The README explains how to deploy it</div>);

  const hostLacksChain = mini.inMiniApp && mini.chains.length > 0 && !mini.chains.includes(`eip155:${net.chain.id}`);
  if (hostLacksChain)
    return wrap(
      <div className="text-[14px] text-fg-2">
        This app&apos;s wallet doesn&apos;t support {net.chain.name}. Pick another network at the top, or open Backing in a browser to try the free demo
      </div>,
    );

  if (!d.demo) return null;

  return wrap(
    <>
      <div className="flex flex-col gap-3 text-[13px] sm:flex-row sm:items-center">
        <p className="flex-1 text-fg-2">
          <span className="text-fg">{net.label}.</span> Test USDC and a demo vault running at {Math.round(apr * 100).toLocaleString("en-US")}% a year, so you can watch income move
          {net.key === "sepolia" && (
            <>
              . Gas comes from the{" "}
              <a className="underline decoration-[var(--line-2)] underline-offset-2" href="https://portal.cdp.coinbase.com/products/faucet" target="_blank" rel="noreferrer">
                Base Sepolia faucet
              </a>
            </>
          )}
        </p>
        {address && (
          <div className="flex items-center gap-3">
            <span className="num text-[13px] text-muted">
              {money(num(bal.data as bigint | undefined))} {net.symbol}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={tx.state.status === "pending"}
              onClick={() =>
                tx.send(
                  [{ label: "Mint 1,000 test USDC", run: () => tx.writeContractAsync({ chainId: net.chain.id, address: d.usdc, abi: mockUsdcAbi, functionName: "faucet" }) }],
                  "Added 1,000 tUSDC to your wallet",
                )
              }
            >
              Get 1,000 test USDC
            </button>
          </div>
        )}
      </div>
      <TxStatus state={tx.state} />
    </>,
  );
}

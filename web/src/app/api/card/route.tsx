import { ImageResponse } from "next/og";
import { createPublicClient, http, isAddress, formatUnits } from "viem";
import { backingAbi } from "@/lib/abi";
import { NETWORKS, netFromParam } from "@/lib/networks";

/** 3:2 share card for a creator: the image Base App shows on a cast, and the OG image elsewhere. */
export const revalidate = 300;

const RPC: Record<string, string | undefined> = {
  sepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC,
  base: process.env.NEXT_PUBLIC_BASE_RPC,
  local: "http://127.0.0.1:8545",
};

const fmt = (v: bigint) => "$" + Number(formatUnits(v, 6)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Creator = { name: string; handle: string; principal: bigint; backerCount: bigint; totalEarned: bigint; registeredAt: bigint };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const addr = searchParams.get("c") ?? "";
  const net = NETWORKS[netFromParam(searchParams.get("net"))];
  let c: Creator | null = null;
  let backers: bigint[] = [];
  if (isAddress(addr) && net.deployment) {
    try {
      const client = createPublicClient({ chain: net.chain, transport: http(RPC[net.key]) });
      c = (await client.readContract({ address: net.deployment.backing, abi: backingAbi, functionName: "getCreator", args: [addr] })) as unknown as Creator;
      const b = (await client.readContract({ address: net.deployment.backing, abi: backingAbi, functionName: "getBackers", args: [addr] })) as unknown as [string[], bigint[], bigint[]];
      backers = [...b[1]].sort((x, y) => (y > x ? 1 : -1));
      if (!c || c.registeredAt === 0n) c = null;
    } catch {
      c = null;
    }
  }

  const cols = 6;
  const rows = Math.max(5, Math.ceil((backers.length + 1) / cols));
  const fill = (i: number) => {
    const idx = (rows - 1 - Math.floor(i / cols)) * cols + (i % cols);
    return idx;
  };
  const cells: string[] = Array(rows * cols).fill("#1a1e28");
  backers.forEach((v, i) => {
    const n = Number(formatUnits(v, 6));
    cells[fill(i)] = n >= 1000 ? "#f0a83a" : n >= 100 ? "rgba(240,168,58,0.68)" : "rgba(240,168,58,0.38)";
  });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0d14", color: "#eef0f5", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, color: "#a3a9b8" }}>
            <div style={{ width: 30, height: 30, display: "flex", flexWrap: "wrap", gap: 2 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 14, height: 14, background: "#f0a83a", display: "flex", borderTopLeftRadius: i === 0 ? 4 : 0, borderTopRightRadius: i === 1 ? 4 : 0, borderBottomLeftRadius: i === 2 ? 4 : 0, borderBottomRightRadius: i === 3 ? 4 : 0 }} />
              ))}
            </div>
            Backing
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: c ? 76 : 84, lineHeight: 1.05, letterSpacing: -2, maxWidth: 640 }}>{c ? c.name : "Back creators with money you keep"}</div>
            <div style={{ fontSize: 30, color: "#a3a9b8", marginTop: 20, maxWidth: 620 }}>
              {c
                ? `${Number(c.backerCount)} backer${Number(c.backerCount) === 1 ? "" : "s"} · ${fmt(c.principal)} behind them`
                : "Stake USDC. The yield goes to them. Your money stays yours"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {c && <div style={{ fontSize: 26, color: "#a3a9b8" }}>Earned from backers</div>}
            <div style={{ fontSize: 64, color: "#f0a83a", marginTop: 6 }}>{c ? fmt(c.totalEarned) : "on Base"}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", width: 300 }}>
          <div style={{ display: "flex", width: 120, height: 14, background: "#1a1e28", alignSelf: "center", borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 18, background: "#07080d", border: "1px solid rgba(238,240,245,0.08)", borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
            {cells.map((bg, i) => (
              <div key={i} style={{ width: 34, height: 42, borderRadius: 4, background: bg, display: "flex" }} />
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 800, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}

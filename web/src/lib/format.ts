import { formatUnits, parseUnits } from "viem";

export const DECIMALS = 6;

export function toUnits(v: string): bigint | null {
  try {
    const s = v.trim();
    if (!s || !/^\d*\.?\d*$/.test(s)) return null;
    return parseUnits(s, DECIMALS);
  } catch {
    return null;
  }
}

export function num(v: bigint | undefined | null): number {
  return v ? Number(formatUnits(v, DECIMALS)) : 0;
}

/** $1,234.56 style. Small values get more precision so live yield visibly moves. */
export function usd(n: number, opts: { precise?: boolean } = {}): string {
  const abs = Math.abs(n);
  let digits = 2;
  if (opts.precise) digits = abs >= 1000 ? 4 : 6;
  else if (abs > 0 && abs < 0.01) digits = 4;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function since(ts: number | bigint): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function countdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function errMsg(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; name?: string };
  const m = err?.shortMessage || err?.message || "Something went wrong";
  if (/User rejected|denied/i.test(m)) return "You cancelled in your wallet.";
  if (/insufficient funds/i.test(m)) return "Not enough ETH for gas on this network.";
  const custom = m.match(/reverted with the following reason:\s*\n?(.*)/)?.[1] || m.match(/error (\w+)\(/)?.[1];
  const map: Record<string, string> = {
    CannotBackSelf: "You can't back yourself.",
    AmountTooSmall: "Minimum backing is 1 USDC.",
    InsufficientPrincipal: "That's more than you have staked.",
    EpochNotOver: "This epoch isn't over yet.",
    NothingToClaim: "Nothing to claim yet.",
    AlreadyRegistered: "This wallet already has a creator profile.",
    InvalidProfile: "Check your profile: name is required, bio up to 280 characters.",
    FaucetCooldown: "Faucet is once per hour. Try again later.",
    NotRegistered: "That address isn't a creator.",
  };
  for (const k of Object.keys(map)) if (m.includes(k)) return map[k];
  return custom || m.split("\n")[0];
}

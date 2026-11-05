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

/** One money format everywhere: $1,234.56. Live tickers add digits so the movement is visible. */
export function money(n: number, opts: { live?: boolean } = {}): string {
  const digits = opts.live ? (Math.abs(n) >= 1000 ? 2 : 4) : 2;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function ago(ts: number | bigint): string {
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
  const err = e as { shortMessage?: string; message?: string };
  const m = err?.shortMessage || err?.message || "Something went wrong";
  if (/User rejected|denied|rejected the request/i.test(m)) return "Cancelled in your wallet";
  if (/insufficient funds/i.test(m)) return "Not enough ETH for gas on this network";
  const map: Record<string, string> = {
    CannotBackSelf: "You can't back yourself",
    NoProfile: "Create your profile first",
    UsernameTaken: "That username is taken",
    AmountTooSmall: "The minimum is 1 USDC",
    InsufficientPrincipal: "That's more than you have staked",
    EpochNotOver: "This epoch isn't over yet",
    NothingToClaim: "Nothing to claim yet",
    InvalidProfile: "Usernames are 3 to 20 characters: lowercase letters, numbers and _",
    InvalidPost: "Posts need text or a picture. Text fits in 280 characters",
    DepositLoss: "The vault's share price looks off right now, so we stopped the deposit to protect you. Try again later",
    FaucetCooldown: "The faucet works once an hour",
  };
  for (const k of Object.keys(map)) if (m.includes(k)) return map[k];
  return m.split("\n")[0];
}

export function dateLabel(ts: number | bigint) {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Loyalty badges: how much you back, and for how long. */
export function badges(principal: number, since: bigint | number, now = Math.floor(Date.now() / 1000)) {
  const out: string[] = [];
  out.push(principal >= 1000 ? "Night owl" : principal >= 100 ? "Lamplighter" : "Firefly");
  const nights = Number(since) ? Math.floor((now - Number(since)) / 86400) : 0;
  if (nights >= 100) out.push("100 nights");
  else if (nights >= 30) out.push("30 nights");
  else if (nights >= 7) out.push("First week");
  return out;
}

export const isUsername = (s: string) => /^[a-z0-9_]{3,20}$/.test(s);

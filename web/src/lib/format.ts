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

/** Pulls a 20-byte Farcaster cast hash out of a hash or a cast URL. */
export function parseCastHash(v?: string | null): `0x${string}` | null {
  const m = v?.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/);
  return m ? (m[0].toLowerCase() as `0x${string}`) : null;
}

export const ZERO_CAST = "0x0000000000000000000000000000000000000000" as const;

export function errMsg(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  const m = err?.shortMessage || err?.message || "Something went wrong";
  if (/User rejected|denied|rejected the request/i.test(m)) return "Cancelled in your wallet";
  if (/insufficient funds/i.test(m)) return "Not enough ETH for gas on this network";
  const map: Record<string, string> = {
    CannotBackSelf: "You can't back yourself",
    AmountTooSmall: "The minimum is 1 USDC",
    InsufficientPrincipal: "That's more than you have staked",
    EpochNotOver: "This epoch isn't over yet",
    NothingToClaim: "Nothing to claim yet",
    AlreadyRegistered: "This wallet already has a creator profile",
    InvalidProfile: "Check your profile. A name is required and the bio fits in 280 characters",
    InvalidPost: "Posts need text, a picture or a link. Text fits in 280 characters",
    InvalidComment: "Comments fit in 280 characters",
    UnknownPost: "That post doesn't exist",
    InvalidDuration: "Pick a length to lock for",
    Locked: "This backing is locked until its end date",
    NotEnded: "This backing hasn't ended yet",
    DepositLoss: "The vault's share price looks off right now, so we stopped the deposit to protect you. Try again later",
    NoteTooLong: "Notes fit in 140 characters",
    FaucetCooldown: "The faucet works once an hour",
    NotRegistered: "That address isn't a creator",
  };
  for (const k of Object.keys(map)) if (m.includes(k)) return map[k];
  return m.split("\n")[0];
}

export const DURATIONS = [
  { label: "1 hour", secs: 3600 },
  { label: "1 day", secs: 86_400 },
  { label: "1 week", secs: 604_800 },
  { label: "1 month", secs: 2_592_000 },
  { label: "Ongoing", secs: 0 },
] as const;

/** Human summary of a position's terms. */
export function terms(endsAt: bigint | number, lockedUntil: bigint | number, now = Math.floor(Date.now() / 1000)) {
  const end = Number(endsAt);
  const lock = Number(lockedUntil);
  if (!end) return lock > now ? { label: `Locked for ${countdown(lock - now)}`, ended: false, locked: true } : { label: "Ongoing", ended: false, locked: false };
  if (now >= end) return { label: "Ended", ended: true, locked: false };
  if (lock > now) return { label: `Locked, ends in ${countdown(end - now)}`, ended: false, locked: true };
  return { label: `Ends in ${countdown(end - now)}`, ended: false, locked: false };
}

export function dateLabel(ts: number | bigint) {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

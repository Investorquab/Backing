"use client";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useApr, useStats } from "@/lib/hooks";
import { money, num } from "@/lib/format";
import { SignIn } from "@/components/SignIn";
import { LiveNumber } from "@/components/ui";
import { WindowMark } from "@/components/WindowMark";

const YEAR = 365 * 24 * 3600;

const STEPS: [string, string][] = [
  ["Stake", "Put USDC behind a creator you believe in"],
  ["They earn", "It earns yield on Base — the yield streams to them"],
  ["Withdraw", "Your money stays yours. Take it back any time"],
];

const SAFETY = [
  "Your principal is always withdrawable, to the cent. The contract can never take more than the vault earns.",
  "No admin keys, no upgrades, no fees — and a re-entrancy guard on everything that moves money.",
  "34 tests including fuzzing, invariants and attack tests. Every vault is checked for hidden fees before it's used.",
];

export default function Landing() {
  const { stats, dataUpdatedAt } = useStats();
  const { apr } = useApr();
  const tvl = num(stats?.principal);
  return (
    <div className="flex flex-col gap-4">
      <section className="surface overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex gap-1.5" aria-hidden>
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="h-7 w-5 rounded-[2px]" style={{ background: [2, 5, 6, 9, 12, 13, 16].includes(i) ? "var(--color-lamp)" : "var(--color-raised)" }} />
            ))}
          </div>
          <h1 className="text-[32px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[40px]">Back the creators you follow — with money you keep</h1>
          <p className="mt-3 text-[16px] leading-[1.55] text-fg-2">
            Tips disappear and creator coins dump. On Backing you stake USDC behind someone you believe in: it earns yield on Base, the yield goes to them, and your money stays
            yours. Stop backing, take it back
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/app" className="btn btn-primary btn-lg">
              Try the demo
            </Link>
            <SignIn big />
          </div>
          <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STEPS.map(([t, s], i) => (
              <li key={t} className="rounded-[12px] bg-raised p-4">
                <div className="flex items-center gap-2">
                  <span className="num text-[13px] text-muted">{i + 1}</span>
                  <span className="text-[14px] font-medium">{t}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-fg-2">{s}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--line)] px-6 py-4 text-[14px] text-fg-2 sm:px-8">
          <span>
            <span className="num text-fg">{stats ? money(tvl) : "—"}</span> backing creators
          </span>
          <span className="flex items-center gap-1.5">
            <WindowMark size={12} />
            {stats ? (
              <LiveNumber className="text-fg" value={num(stats.distributed)} perSecond={(tvl * apr) / YEAR} at={dataUpdatedAt} />
            ) : (
              <span className="num text-fg">—</span>
            )}{" "}
            earned by creators
          </span>
        </div>
      </section>

      <section className="surface p-6 sm:p-8">
        <h2 className="text-[20px] font-medium">Why backing, not tipping</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[12px] bg-raised p-4">
            <div className="text-[13px] text-muted">Tips</div>
            <p className="mt-1.5 text-[14px] text-fg-2">Sent once, sold, gone. Nothing left behind</p>
          </div>
          <div className="rounded-[12px] bg-raised p-4">
            <div className="text-[13px] text-muted">Creator coins</div>
            <p className="mt-1.5 text-[14px] text-fg-2">Pump, dump, and the trust goes with it</p>
          </div>
          <div className="rounded-[12px] border border-lamp/40 bg-raised p-4">
            <div className="text-[13px] text-lamp">Backing</div>
            <p className="mt-1.5 text-[14px] text-fg">Your money stays yours — only the yield supports them. Zero downside</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="surface p-6">
          <div className="text-[13px] text-lamp">For creators</div>
          <h3 className="mt-1 text-[17px] font-medium">Recurring income, no selling, no dumping</h3>
          <p className="mt-2 text-[14px] leading-[1.55] text-fg-2">
            Link your Farcaster and your posts show here. Fans back you, and you earn the yield on their stake every epoch — steady support instead of one-off tips.
          </p>
        </div>
        <div className="surface p-6">
          <div className="text-[13px] text-lamp">For backers</div>
          <h3 className="mt-1 text-[17px] font-medium">Support with zero downside</h3>
          <p className="mt-2 text-[14px] leading-[1.55] text-fg-2">
            Your principal never leaves your control — withdraw it in full any time. Only the yield it earns goes to the creator. You lose nothing to support someone.
          </p>
        </div>
      </section>

      <section className="surface p-6 sm:p-8">
        <h2 className="text-[20px] font-medium">Already on Farcaster?</h2>
        <p className="mt-2 text-[15px] leading-[1.55] text-fg-2">
          Search any Farcaster creator and their real posts show up here, tied to their wallet — no new account, no reposting. Back the ones you like, or invite the ones who
          aren&apos;t here yet
        </p>
        <Link href="/search" className="btn btn-primary mt-4">
          Search Farcaster creators
        </Link>
      </section>

      <section className="surface p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} strokeWidth={1.5} className="text-lamp" />
          <h2 className="text-[20px] font-medium">Built to be safe with your money</h2>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {SAFETY.map((s) => (
            <li key={s} className="flex gap-2 text-[14px] leading-[1.5] text-fg-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lamp" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
        <Link href="/security" className="mt-4 inline-block text-[14px] text-lamp hover:underline">
          Read the full security notes
        </Link>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-2 py-6 text-[13px] text-muted">
        <span>Backing — built for Vibeathon 02 · Night shift</span>
        <span className="flex gap-4">
          <Link className="hover:text-fg" href="/security">
            Security
          </Link>
          <a className="hover:text-fg" href="https://blog.vibestarter.xyz/vibeathon-02" target="_blank" rel="noreferrer">
            Vibeathon
          </a>
          <a className="hover:text-fg" href="https://github.com/Investorquab/Backing" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}

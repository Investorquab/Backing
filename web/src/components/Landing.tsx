"use client";
import Link from "next/link";
import { useApr, useBackers, useCreatorActivity, useCreators, useStats, Kind, type CreatorView } from "@/lib/hooks";
import { money, num, short } from "@/lib/format";
import { Avatar } from "./Avatar";
import { TheBlock } from "./TheBlock";
import { LiveNumber, StatRow, Stat } from "./ui";
import { WindowMark } from "./WindowMark";
import { SignIn } from "./SignIn";

const YEAR = 365 * 24 * 3600;

export function Landing() {
  const { data: creators } = useCreators();
  const { stats, dataUpdatedAt } = useStats();
  const { apr } = useApr();
  const top = creators && [...creators].sort((a, b) => (b.principal > a.principal ? 1 : -1))[0];
  const tvl = num(stats?.principal);

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      <section className="grid grid-cols-1 items-center gap-10 pt-4 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-12">
        <div className="enter">
          <h1 className="text-[40px] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[60px] sm:tracking-[-0.03em]">Back creators with money you keep</h1>
          <p className="mt-5 max-w-[34rem] text-[18px] leading-[1.55] text-fg-2 sm:text-[19px]">
            Stake USDC behind someone you believe in. It earns yield on Base while you sleep, the yield goes to them, and you can take every cent back whenever you want
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/discover" className="btn btn-primary btn-lg">
              Find someone to back
            </Link>
            <Link href="/creator" className="btn btn-secondary btn-lg">
              Start as a creator
            </Link>
          </div>
        </div>
        <div className="enter [animation-delay:60ms]">{top ? <Preview c={top} /> : <PreviewEmpty />}</div>
      </section>

      <section>
        <h2 className="text-[24px] font-medium tracking-[-0.01em]">Your capital works the night shift</h2>
        <ol className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-3">
          {[
            ["Stake, don't spend", "Put USDC behind a creator. It goes into an audited lending vault on Base"],
            ["The yield is theirs", "Borrowers pay interest on that USDC. Creators collect it once per epoch"],
            ["Leave whenever", "Withdraw your full principal any time. Their income from you stops, your money never left"],
          ].map(([t, d], i) => (
            <li key={t} className="border-t border-[var(--line)] pt-4">
              <div className="num text-[12px] text-muted">0{i + 1}</div>
              <div className="mt-2 text-[16px] font-medium">{t}</div>
              <p className="mt-1 text-[14px] text-fg-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <StatRow cols={3}>
          <Stat label="Backing on Backing">{money(tvl)}</Stat>
          <Stat label="Creators">{stats ? Number(stats.creators) : "0"}</Stat>
          <Stat label="Yield sent to creators">
            <LiveNumber value={num(stats?.distributed)} perSecond={(tvl * apr) / YEAR} at={dataUpdatedAt} />
          </Stat>
        </StatRow>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <SignIn big />
          <span className="text-[14px] text-fg-2">Sign in to see the feed from the people you back</span>
        </div>
      </section>
    </div>
  );
}

function Preview({ c }: { c: CreatorView }) {
  const { apr } = useApr();
  const { rows } = useBackers(c.creator);
  const { data: act, dataUpdatedAt } = useCreatorActivity(c.creator, 20);
  const lastNote = act?.find((a) => a.kind === Kind.Backed && a.text);
  const p = num(c.principal);
  return (
    <Link href={`/c/${c.creator}`} className="surface block overflow-hidden transition-colors hover:border-[var(--line-2)]">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
        <Avatar address={c.creator} src={c.avatar} name={c.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{c.name}</div>
          <div className="text-[13px] text-muted">
            {Number(c.backerCount)} backers · {money(p)} behind them
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-stretch gap-6 px-5 pb-5 pt-5">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-[13px] text-fg-2">
            <WindowMark size={12} /> Earned from backers
          </div>
          <LiveNumber className="mt-2 block text-[34px] font-medium leading-none text-lamp sm:text-[40px]" value={num(c.totalEarned)} perSecond={(p * apr) / YEAR} at={dataUpdatedAt} />
          {lastNote && (
            <div className="mt-auto pt-6">
              <p className="max-w-[20rem] border-l-2 border-[var(--line-2)] pl-3 text-[14px] text-fg-2">
                {lastNote.text}
                <span className="num mt-1 block text-[12px] text-muted">{short(lastNote.actor)}</span>
              </p>
            </div>
          )}
        </div>
        <TheBlock className="w-[132px] sm:w-[156px]" cols={4} minRows={5} lit={(rows ?? []).map((r) => ({ key: r.backer, amount: num(r.principal) }))} />
      </div>
    </Link>
  );
}

function PreviewEmpty() {
  return (
    <div className="surface p-6">
      <div className="text-[13px] text-fg-2">The first backers light the first windows</div>
      <TheBlock className="mt-4 w-[180px]" cols={4} minRows={5} lit={[]} />
    </div>
  );
}

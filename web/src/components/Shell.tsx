"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Bell, Compass, House, LampDesk, PenLine, Search, UserRound, Wallet } from "lucide-react";
import { useCreator, useCreators, useApr } from "@/lib/hooks";
import { useNotifications } from "@/lib/notifications";
import { useUi } from "@/lib/ui-state";
import { money, num } from "@/lib/format";
import { Wordmark, WindowMark } from "./WindowMark";
import { SignIn } from "./SignIn";
import { NetworkSwitch } from "./NetworkSwitch";
import { Avatar } from "./Avatar";

type Item = { href: string; label: string; icon: typeof House; badge?: number };

function useNav(): Item[] {
  const { address } = useAccount();
  const { data: me } = useCreator(address);
  const { unread } = useNotifications();
  const items: Item[] = [
    { href: "/", label: "Home", icon: House },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: address ? unread : 0 },
    { href: "/me", label: "My backing", icon: Wallet },
    { href: "/creator", label: "Studio", icon: LampDesk },
  ];
  if (me) items.push({ href: `/c/${me.creator}`, label: "Profile", icon: UserRound });
  return items;
}

const active = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="num absolute -right-1.5 -top-1 min-w-4 rounded-full bg-lamp px-1 text-center text-[11px] leading-4 text-lamp-ink">{n > 9 ? "9+" : n}</span>;
}

export function Sidebar() {
  const path = usePathname();
  const items = useNav();
  const { address } = useAccount();
  const { data: me } = useCreator(address);
  const ui = useUi();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col items-center gap-1 py-3 md:flex lg:w-[248px] lg:items-stretch lg:px-3">
      <Link href="/" className="mb-3 flex h-12 items-center justify-center rounded-[10px] lg:justify-start lg:px-3" aria-label="Backing home">
        <span className="hidden lg:block">
          <Wordmark />
        </span>
        <span className="lg:hidden">
          <WindowMark size={24} />
        </span>
      </Link>
      <nav className="flex flex-col gap-1">
        {items.map((n) => {
          const on = active(path, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              title={n.label}
              className={`group flex h-12 items-center gap-4 rounded-[12px] px-3 text-[17px] transition-colors hover:bg-raised ${on ? "font-medium text-fg" : "text-fg-2"}`}
            >
              <span className="relative">
                <n.icon size={22} strokeWidth={on ? 2 : 1.5} className={on ? "text-fg" : ""} />
                <Badge n={n.badge} />
              </span>
              <span className="hidden lg:inline">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      {me ? (
        <button className="btn btn-primary btn-lg mt-4 w-12 px-0 lg:w-full" onClick={ui.openCompose} aria-label="New post">
          <PenLine size={18} strokeWidth={1.5} className="lg:hidden" />
          <span className="hidden lg:inline">Post</span>
        </button>
      ) : (
        <Link href="/creator" className="btn btn-secondary btn-lg mt-4 hidden w-full lg:inline-flex">
          Start as a creator
        </Link>
      )}
      <div className="mt-auto flex flex-col items-center gap-2 lg:items-stretch">
        <div className="hidden lg:block">
          <NetworkSwitch />
        </div>
        <SignIn wide />
      </div>
    </aside>
  );
}

export function RightRail() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data } = useCreators();
  const { incomeApr } = useApr();
  const top = [...(data ?? [])].sort((a, b) => (b.principal > a.principal ? 1 : -1)).slice(0, 5);
  return (
    <aside className="sticky top-0 hidden h-dvh w-[320px] shrink-0 flex-col gap-4 overflow-y-auto py-3 pl-6 xl:flex">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/discover?q=${encodeURIComponent(q)}`);
        }}
        className="relative"
      >
        <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input h-11 rounded-full bg-card pl-10" placeholder="Search name or @X username" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </form>
      {top.length > 0 && (
        <section className="surface overflow-hidden">
          <h2 className="px-4 pb-2 pt-3 text-[17px] font-medium">Creators to back</h2>
          <ul>
            {top.map((c) => (
              <li key={c.creator}>
                <Link href={`/c/${c.creator}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/60">
                  <Avatar address={c.creator} src={c.avatar} name={c.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{c.name}</div>
                    <div className="truncate text-[13px] text-muted">{c.x ? `@${c.x}` : `${Number(c.backerCount)} backers`}</div>
                  </div>
                  <span className="num text-[12px] text-fg-2">{money((num(c.principal) * incomeApr) / 12)}/mo</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/discover" className="block px-4 py-3 text-[14px] text-lamp hover:bg-raised/60">
            Show more
          </Link>
        </section>
      )}
      <p className="px-2 text-[12px] leading-relaxed text-muted">
        Backing is experimental software built for Vibestarter Vibeathon 02. Principal sits in a third-party ERC-4626 vault and carries smart-contract and vault risk. Backers earn no
        return. Not financial advice. <Link href="/security" className="underline underline-offset-2">Security</Link>
      </p>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--line)] bg-bg/90 px-4 backdrop-blur md:hidden">
      <Link href="/" aria-label="Backing home">
        <Wordmark />
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <NetworkSwitch />
        <SignIn />
      </div>
    </header>
  );
}

export function TabBar() {
  const path = usePathname();
  const items = useNav().filter((n) => ["/", "/discover", "/notifications", "/creator"].includes(n.href));
  const { address } = useAccount();
  const { data: me } = useCreator(address);
  const ui = useUi();
  return (
    <>
      {me && (
        <button
          onClick={ui.openCompose}
          className="btn btn-primary fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-30 h-14 w-14 rounded-full px-0 shadow-[0_8px_24px_rgba(0,0,0,0.4)] md:hidden"
          aria-label="New post"
        >
          <PenLine size={20} strokeWidth={1.5} />
        </button>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {items.map((n) => {
            const on = active(path, n.href);
            return (
              <Link key={n.href} href={n.href} aria-label={n.label} className={`flex h-14 items-center justify-center ${on ? "text-fg" : "text-muted"}`}>
                <span className="relative">
                  <n.icon size={22} strokeWidth={on ? 2 : 1.5} />
                  <Badge n={n.badge} />
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Sticky title bar at the top of the centre column, like a social app. */
export function PageHeader({ title, sub, back, children }: { title: string; sub?: string; back?: boolean; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="sticky top-14 z-20 border-b border-[var(--line)] bg-bg/90 backdrop-blur md:top-0">
      <div className="flex h-14 items-center gap-4 px-4">
        {back && (
          <button className="btn btn-quiet btn-sm -ml-2 w-9 px-0" onClick={() => router.back()} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-medium leading-tight">{title}</h1>
          {sub && <div className="truncate text-[13px] text-muted">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Full-width tabs under a PageHeader, with the active tab underlined in the accent. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex" role="tablist">
      {tabs.map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={`relative flex h-12 flex-1 items-center justify-center text-[15px] transition-colors hover:bg-raised/50 ${value === k ? "font-medium text-fg" : "text-muted"}`}
        >
          {label}
          {value === k && <span className="absolute bottom-0 h-[3px] w-14 rounded-full bg-lamp" />}
        </button>
      ))}
    </div>
  );
}

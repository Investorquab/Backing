"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { Bell, Home, PieChart, Plus, Search, UserRound } from "lucide-react";
import { useProfile } from "@/lib/hooks";
import { useNotifications } from "@/lib/notifications";
import { useUi } from "@/lib/ui-state";
import { captureRef } from "@/lib/invite";
import { Wordmark } from "./WindowMark";
import { NetToggle } from "./NetToggle";
import { SignIn } from "./SignIn";

const LINKS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/search", label: "Discover", icon: Search },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
];
const on = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function Dot({ n }: { n: number }) {
  if (!n) return null;
  return <span className="num absolute -right-1.5 -top-1 min-w-4 rounded-full bg-lamp px-1 text-center text-[11px] leading-4 text-lamp-ink">{n > 9 ? "9+" : n}</span>;
}

/** Top bar: logo, a few clear destinations, and you. */
export function TopBar() {
  const path = usePathname();
  const { address } = useAccount();
  const { data: me } = useProfile(address);
  const { unread } = useNotifications();
  const ui = useUi();
  useEffect(() => captureRef(), []);
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center gap-3 px-4">
        <Link href="/" aria-label="Backing home" className="mr-2">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex h-9 items-center rounded-full px-4 text-[15px] transition-colors ${on(path, l.href) ? "bg-raised text-fg" : "text-fg-2 hover:text-fg"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NetToggle />
          {address && (
            <Link href="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full text-fg-2 hover:bg-raised hover:text-fg" aria-label="Notifications">
              <Bell size={20} strokeWidth={1.5} />
              <Dot n={unread} />
            </Link>
          )}
          {me && (
            <button className="btn btn-primary btn-sm hidden px-4 md:inline-flex" onClick={ui.openCompose}>
              <Plus size={16} strokeWidth={2} /> Post
            </button>
          )}
          <SignIn />
        </div>
      </div>
    </header>
  );
}

/** Phone tab bar. */
export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const { address } = useAccount();
  const { data: me } = useProfile(address);
  const ui = useUi();
  const meHref = me ? `/u/${me.profile.username}` : "/profile/edit";
  const tab = (href: string, label: string, Icon: typeof Home) => (
    <Link href={href} aria-label={label} className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${on(path, href) ? "text-fg" : "text-muted"}`}>
      <Icon size={21} strokeWidth={on(path, href) ? 2 : 1.5} />
      {label}
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="flex items-center">
        {tab("/app", "Home", Home)}
        {tab("/search", "Discover", Search)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={() => (me ? ui.openCompose() : router.push("/profile/edit"))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-lamp text-lamp-ink"
            aria-label="New post"
          >
            <Plus size={22} strokeWidth={2} />
          </button>
        </div>
        {tab("/portfolio", "Portfolio", PieChart)}
        {tab(meHref, "Me", UserRound)}
      </div>
    </nav>
  );
}

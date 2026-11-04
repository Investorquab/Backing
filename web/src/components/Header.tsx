"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LampDesk, Rows3, Search, Wallet } from "lucide-react";
import { Wordmark } from "./WindowMark";
import { SignIn } from "./SignIn";
import { NetworkSwitch } from "./NetworkSwitch";

export const NAV = [
  { href: "/", label: "Feed", icon: Rows3 },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/me", label: "My backing", icon: Wallet },
  { href: "/creator", label: "Studio", icon: LampDesk },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-deep/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="mr-4 shrink-0" aria-label="Backing home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex h-8 items-center rounded-[8px] px-3 text-[14px] transition-colors ${isActive(path, n.href) ? "bg-raised text-fg" : "text-fg-2 hover:text-fg"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/discover" className="btn btn-quiet btn-sm w-8 px-0" aria-label="Search creators">
            <Search size={16} strokeWidth={1.5} />
          </Link>
          <NetworkSwitch />
          <SignIn />
        </div>
      </div>
    </header>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-deep/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-4">
        {NAV.map((n) => {
          const on = isActive(path, n.href);
          return (
            <Link key={n.href} href={n.href} className={`flex h-14 flex-col items-center justify-center gap-1 text-[12px] ${on ? "text-fg" : "text-muted"}`}>
              <n.icon size={18} strokeWidth={1.5} className={on ? "text-lamp" : ""} />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

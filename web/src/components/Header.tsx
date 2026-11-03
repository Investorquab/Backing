"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ConnectButton } from "./ConnectButton";
import { NetworkSwitch } from "./NetworkSwitch";

const NAV = [
  { href: "/", label: "Discover" },
  { href: "/me", label: "My backings" },
  { href: "/creator", label: "Creator" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span className="text-lg">Backing</span>
        </Link>
        <nav className="ml-4 hidden gap-1 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-3 py-1.5 text-sm ${path === n.href ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NetworkSwitch />
          <ConnectButton />
        </div>
      </div>
      <nav className="flex gap-1 border-t border-line/50 px-4 py-2 sm:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex-1 rounded-full px-2 py-1.5 text-center text-sm ${path === n.href ? "bg-panel-2 text-fg" : "text-muted"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

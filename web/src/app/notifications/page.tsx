"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { Kind, usePeopleMap, type Activity, type ProfileView } from "@/lib/hooks";
import { useNotifications } from "@/lib/notifications";
import { ago, money, num, short } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { SignIn } from "@/components/SignIn";
import { Skeleton } from "@/components/ui";

export default function Notifications() {
  const { address, isConnected } = useAccount();
  const { items, seen, markSeen, isLoading } = useNotifications();
  const people = usePeopleMap();

  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(markSeen, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!isConnected)
    return (
      <div className="surface flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="text-[20px] font-medium">Connect to see your notifications</div>
        <SignIn big />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-medium">Notifications</h1>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : items.length === 0 ? (
        <div className="surface px-6 py-12 text-center text-fg-2">When someone backs you, or backs someone through your invite link, it shows up here</div>
      ) : (
        <ul className="surface divide-line overflow-hidden">
          {items.map((a) => (
            <Item key={a.id.toString()} a={a} me={address!} people={people} fresh={a.id > seen} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({ a, me, people, fresh }: { a: Activity; me: string; people: Map<string, ProfileView>; fresh: boolean }) {
  const who = people.get(a.actor.toLowerCase());
  const subject = people.get(a.subject.toLowerCase());
  const name = who ? `@${who.profile.username}` : short(a.actor);
  const amt = <span className="num">{money(num(a.amount))}</span>;
  const viaMyLink = a.kind === Kind.Backed && a.referrer.toLowerCase() === me.toLowerCase() && a.subject.toLowerCase() !== me.toLowerCase();
  let text: React.ReactNode;
  if (a.kind === Kind.Milestone) text = <>You passed {amt} in backing</>;
  else if (viaMyLink)
    text = (
      <>
        Your invite brought {name}. They backed {subject ? `@${subject.profile.username}` : short(a.subject)} with {amt}
      </>
    );
  else if (a.kind === Kind.Backed) text = <>{name} backed you with {amt}</>;
  else text = <>{name} stopped backing you and took back {amt}</>;
  const href = who ? `/u/${who.profile.username}` : `/u/${a.actor}`;
  return (
    <li>
      <Link href={a.kind === Kind.Milestone ? "/portfolio" : href} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/60 ${fresh ? "bg-raised/40" : ""}`}>
        <Avatar address={a.actor} src={who?.profile.avatar} name={who?.profile.username} size={36} />
        <p className="min-w-0 flex-1 text-[15px]">
          {text} <span className="text-muted">· {ago(a.time)}</span>
        </p>
        {fresh && <span className="h-2 w-2 shrink-0 rounded-full bg-lamp" aria-label="New" />}
      </Link>
    </li>
  );
}

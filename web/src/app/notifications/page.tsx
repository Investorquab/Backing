"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { MessageCircle, Undo2 } from "lucide-react";
import { Kind, useCreator, useCreatorMap, type Activity, type CreatorView } from "@/lib/hooks";
import { useNotifications } from "@/lib/notifications";
import { ago, money, num, short } from "@/lib/format";
import { useUi } from "@/lib/ui-state";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Shell";
import { SignIn } from "@/components/SignIn";
import { WindowMark } from "@/components/WindowMark";
import { Skeleton } from "@/components/ui";

export default function Notifications() {
  const { address, isConnected } = useAccount();
  const { data: me } = useCreator(address);
  const { items, ended, seen, markSeen, isLoading } = useNotifications();
  const creators = useCreatorMap();
  const ui = useUi();

  // mark as read a moment after opening, so new items still flash as new this time
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(markSeen, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!isConnected)
    return (
      <>
        <PageHeader title="Notifications" />
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <div className="text-[20px] font-medium">Sign in to see who backed you</div>
          <SignIn big />
        </div>
      </>
    );

  return (
    <>
      <PageHeader title="Notifications" />
      {ended.map((p) => (
        <div key={p.creator} className="flex gap-3 border-b border-[var(--line)] bg-raised/30 px-4 py-4">
          <Undo2 size={22} strokeWidth={1.5} className="mt-1 shrink-0 text-lamp" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px]">
              Your backing of <span className="font-medium">{p.creatorName}</span> has ended. Your <span className="num">{money(num(p.principal))}</span> is ready to come back
            </p>
            <button className="btn btn-primary btn-sm mt-2" onClick={() => ui.openBack({ creator: p.creator })}>
              Close and withdraw
            </button>
          </div>
        </div>
      ))}
      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-40" />
        </div>
      ) : items.length === 0 && ended.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <div className="text-[20px] font-medium">Nothing to see yet</div>
          <p className="mx-auto mt-2 max-w-sm text-fg-2">
            {me ? "When someone backs you, comments on your posts or you hit a milestone, it shows here" : (
              <>
                Notifications are mostly for creators.{" "}
                <Link className="text-lamp hover:underline" href="/creator">
                  Start as a creator
                </Link>
              </>
            )}
          </p>
        </div>
      ) : (
        items.map((a) => <Item key={a.id.toString()} a={a} creators={creators} fresh={a.id > seen} />)
      )}
    </>
  );
}

function Item({ a, creators, fresh }: { a: Activity; creators: Map<string, CreatorView>; fresh: boolean }) {
  const who = creators.get(a.actor.toLowerCase());
  const name = <span className="font-medium">{who?.name ?? short(a.actor)}</span>;
  let icon = <WindowMark size={22} />;
  let body: React.ReactNode = null;
  let href: string | undefined;
  if (a.kind === Kind.Backed) {
    body = (
      <>
        {name} backed you with <span className="num">{money(num(a.amount))}</span>
        {a.ref > 0n && " from your post"}
      </>
    );
    href = a.ref > 0n ? `/p/${a.ref}` : undefined;
  } else if (a.kind === Kind.Commented) {
    icon = <MessageCircle size={22} strokeWidth={1.5} className="text-fg-2" />;
    body = <>{name} commented on your post</>;
    href = `/p/${a.ref}`;
  } else if (a.kind === Kind.Milestone) {
    body = (
      <>
        You passed <span className="num">{money(num(a.amount))}</span> in backing
      </>
    );
  } else if (a.kind === Kind.Ended) {
    icon = <Undo2 size={22} strokeWidth={1.5} className="text-fg-2" />;
    body = (
      <>
        {name}&apos;s backing of <span className="num">{money(num(a.amount))}</span> ended
      </>
    );
  } else if (a.kind === Kind.Claimed) {
    body = (
      <>
        You claimed <span className="num">{money(num(a.amount))}</span>
      </>
    );
  }
  const content = (
    <div className={`flex gap-3 border-b border-[var(--line)] px-4 py-3 transition-colors hover:bg-raised/30 ${fresh ? "bg-raised/30" : ""}`}>
      <div className="w-8 shrink-0 pt-1">{icon}</div>
      <div className="min-w-0 flex-1">
        <Avatar address={a.actor} src={who?.avatar} name={who?.name} size={32} />
        <p className="mt-2 text-[15px]">
          {body} <span className="text-muted">· {ago(a.time)}</span>
        </p>
        {a.text && <p className="mt-1 text-[15px] text-fg-2">{a.text}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
